import FragmentedMpeg from '../../helpers/fragmentedMpeg';
import {InputFileLocation} from '../../layer';
import {DownloadOptions, MyUploadFile} from '../mtproto/apiFileManager';
import {getMtprotoMessagePort, log, serviceMessagePort} from './index.service';
import deferredPromise, {CancellablePromise} from '../../helpers/cancellablePromise';
import timeout from './timeout';
import {ServiceRequestVideoStreamTaskPayload} from './serviceMessagePort';

const deferredPromises: Map<MessagePort, {[taskId: string]: CancellablePromise<MyUploadFile>}> = new Map();

setInterval(() => {
  const mtprotoMessagePort = getMtprotoMessagePort();
  for(const [messagePort, promises] of deferredPromises) {
    if(messagePort === mtprotoMessagePort) {
      continue;
    }

    for(const taskId in promises) {
      const promise = promises[taskId];
      promise.reject();
    }

    deferredPromises.delete(messagePort);
  }
}, 120e3);

type StreamRange = [number, number];
const INFINITE_SIZE = 100*1024*1024*1024; // 100 Gb is infinite
function parseRange(header: string): StreamRange {
  if(!header) return [0, 0];
  const [, chunks] = header.split('=');
  const ranges = chunks.split(', ');
  const [offset, end] = ranges[0].split('-');

  return [+offset, +end || 0];
}
function responseForSafariFirstRange(range: StreamRange): Response {
  if(range[0] === 0 && range[1] === 1) {
    return new Response(new Uint8Array(2).buffer, {
      status: 206,
      statusText: 'Partial Content',
      headers: {
        'Accept-Ranges': 'bytes',
        'Transfer-Encoding': 'chunked',
        'Content-Range': `bytes 0-1/${INFINITE_SIZE}`,
        'Content-Length': '2',
        'Content-Type': 'video/mp4'
      }
    });
  }
  return null;
}

type StreamId = string | number;
class VideoStreamHandler {
  public stream: VideoStream;
  public range: StreamRange;
  public event: FetchEvent;
  public response: Promise<Response>;
  public controller: ReadableStreamDefaultController;
  public written: number = 0;
  public promised: number = 0;
  public withRange: boolean;
  private respond: (resp: Response) => void;

  constructor(stream: VideoStream, range: StreamRange) {
    this.withRange = true;
    if(range[1] == 0) {
      range[1] = INFINITE_SIZE-1;
      this.withRange = false;
    } else {
      range[1] = range[0] + 192 * 1024 - 1;
    }
    this.stream = stream;
    this.range = range;

    this.promised = range[1]-range[0]+1;
    this.response = new Promise((resolve: any) => {
      this.respond = (resp: Response) => {
        resolve(resp);
      }
    });

    this.respond(new Response(new ReadableStream({
      start: (controller) => {
        this.controller = controller;
      },
      cancel: () => {
        console.log('cancelled videostream');
        this.destroy();
      }
    }), {
      status: this.withRange ? 206 : 200,
      statusText: this.withRange ? 'Partial Content' : 'OK',
      headers: this.withRange ? { // For Safari
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${range[0]}-${range[1]}/${range[1]+1}`,
        'Content-Length': `${range[1]-range[0]+1}`,
        'Content-Type': 'video/mp4'
      } : { // Chrome works fine without partial requests
        // 'Accept-Ranges': 'bytes',
        'Transfer-Encoding': 'chunked',
        // 'Content-Range': `bytes ${range[0]}-${range[1]}/${INFINITE_SIZE}`,
        // 'Content-Length': `${range[1]-range[0]+1}`,
        // 'Content-Length': '-1',
        'Content-Type': 'video/mp4'
      }
    }));
  }

  public destroy() {
    this.stream.handlers = this.stream.handlers.filter(handler => handler != this);
    try {
      this.controller && this.controller.close();
    } catch(e) {
      console.error(e);
    }
    if(!this.stream.handlers.length && !this.stream.stopped) {
      // const params = this.stream.params;
    }
  }

  public pushBuffers() {
    /*
    if(this.withRange) {
      const last = this.stream.buffers[this.stream.buffers.length - 1];
      let st = this.stream.firstOffs;
      for(let i = 0; i < this.stream.buffers.length - 1; i++) {
        st += this.stream.buffers[i].length;
      }
      const en = st + last.length - 1;
      const crng = `bytes ${st}-${en}/${en+1}`;
      console.log('st = ', st, ', content-range: ', crng);
      this.respond(new Response(last, {
        status: 206,
        statusText: 'Partial Content',
        headers: { // For Safari
          'Accept-Ranges': 'bytes',
          'Content-Range': crng,
          'Content-Length': `${last.length}`,
          'Content-Type': 'video/mp4'
        }
      }));
      this.destroy();
      return;
    }
    */

    let offs = this.stream.firstOffs;
    // console.log('buffers (fo = ' + offs + '): ' + this.stream.buffers.map(buf => buf.length).join(', ') + '; range: ' + this.range.join(', '));
    let i = 0;
    for(const buf of this.stream.buffers) {
      const size = buf.length;
      if(offs + size > this.range[0]) {
        if(offs + size >= this.range[1]) {
          // Last part
          // console.log('  enqueue #' + i + ', ' + (this.range[0] - offs) + '-' + (this.range[1] - offs + 1));
          const b = buf.slice(this.range[0] - offs, this.range[1] - offs + 1);
          this.written += b.length;
          this.controller.enqueue(b);
          // console.log('handler wrote ' + this.written + ' bytes, promised ' + this.promised);
          this.destroy();
          return;
        } else if(offs == this.range[0]) {
          // console.log('  enqueue #' + i + ', 0-...');
          this.written += buf.length;
          this.controller.enqueue(buf);
        } else {
          // console.log('  enqueue #' + i + ', ' + (this.range[0] - offs) + '-...');
          const b = buf.slice(this.range[0] - offs);
          this.written += b.length;
          this.controller.enqueue(b);
        }
        this.range[0] = offs + size;
      }
      offs += size;
      i++;
    }
  }
}
class VideoStream {
  static instance: VideoStream;
  public fragmentedMpeg: FragmentedMpeg;
  public timeout: any;
  public lastTime: number;
  public lastSize: number;
  public baseTs: number = 0;
  public curDelay: number = 2000; // maybe increase to preload more
  public stopped: boolean;
  public info: ServiceRequestVideoStreamTaskPayload;
  public buffers: Uint8Array[] = [];
  public firstOffs: number = 0;
  public handlers: VideoStreamHandler[] = [];

  constructor(public params: string) {
    VideoStream.instance = this;
    this.info = JSON.parse(decodeURIComponent(this.params));
    this.baseTs = +this.info.timeMs || 0;
    this.fragmentedMpeg = new FragmentedMpeg();
    this.nextChunk();
  }

  public destroy() {
    console.log('stream destroyed');
    VideoStream.instance = null;
    this.stopped = true;
    clearTimeout(this.timeout);
    for(const handler of this.handlers) {
      handler.destroy();
    }
  }

  private async requestFilePartFromWorker() {
    const taskId = JSON.stringify(this.info);

    const mtprotoMessagePort = getMtprotoMessagePort();
    let promises = deferredPromises.get(mtprotoMessagePort);
    if(!promises) {
      deferredPromises.set(mtprotoMessagePort, promises = {});
    }

    let deferred = promises[taskId];
    if(deferred) {
      return deferred;
    }

    deferred = promises[taskId] = deferredPromise();

    this.info.timeMs = -this.curDelay;
    /* if(this.baseTs) {
      this.baseTs += 1000;
    }*/
    serviceMessagePort.invoke('requestVideoStreamPart', this.info, undefined, mtprotoMessagePort)
    .then(deferred.resolve.bind(deferred), deferred.reject.bind(deferred)).finally(() => {
      if(promises[taskId] === deferred) {
        delete promises[taskId];

        if(!Object.keys(promises).length) {
          deferredPromises.delete(mtprotoMessagePort);
        }
      }
    });

    return deferred;
  }

  cleanupBuffers() {
    // Remove old buffers to free memory (store size of removed buffers as firstOffs)
    let totalSize = 0;
    for(let i = this.buffers.length - 1; i >= 1; i--) {
      totalSize += this.buffers[i].length;
      if(totalSize > 4*1024*1024) { // 4 Mb limit
        for(let j = 0; j < i; j++) {
          this.firstOffs += this.buffers[j].length;
        }
        this.buffers = this.buffers.slice(i);
        return;
      }
    }
  }

  async nextChunk() {
    const t0 = Date.now();
    const result = await this.requestFilePartFromWorker();
    console.log('recvd', result.mtime, ', ', result.bytes.byteLength, ' bytes');
    if(this.stopped) {
      return;
    }

    if((this.lastTime == result.mtime) || (this.lastSize == result.bytes.byteLength)) { // Not yet updated, wait a little bit
      this.timeout = setTimeout(this.nextChunk.bind(this), 200);
      return;
    }
    this.lastTime = result.mtime;
    this.lastSize = result.bytes.byteLength;

    const rawMp4 = result.bytes.buffer.slice(32);
    const fragMp4 = this.fragmentedMpeg.appendChunk(rawMp4);

    this.buffers.push(...fragMp4.map(buf => new Uint8Array(buf)));
    for(const handler of this.handlers) {
      handler.pushBuffers();
    }
    this.cleanupBuffers();

    const dt = Date.now() - t0;
    console.log('delay = ', this.curDelay, ', dt = ', dt, ', time left = ', 1000 - dt, ', buffer# = ', this.buffers.length, ', handler# = ', this.handlers.length);

    if(this.curDelay > 1000) { // Keep loading chunks
      this.curDelay -= 1000;
      this.timeout = setTimeout(this.nextChunk.bind(this), 100);
      return;
    }
    this.timeout = setTimeout(this.nextChunk.bind(this), 1000 - dt);
  }

  public async response(range: StreamRange): Promise<Response> {
    const possibleResponse = responseForSafariFirstRange(range);
    if(possibleResponse) {
      return possibleResponse;
    }
    const handler = new VideoStreamHandler(this, range);
    this.handlers.push(handler);
    return handler.response;
  }

  public handle(event: FetchEvent, range: StreamRange) {
    const possibleResponse = responseForSafariFirstRange(range);
    if(possibleResponse) {
      event.respondWith(possibleResponse);
      return;
    }
    const handler = new VideoStreamHandler(this, range);
    this.handlers.push(handler);
  }
}

export default function onVideoStreamFetch(event: FetchEvent, params: string) {
  if(params == 'abort') {
    VideoStream.instance && VideoStream.instance.destroy();
    event.respondWith(new Response(''));
    return;
  }

  const range = parseRange(event.request.headers.get('Range'));
  let stream: VideoStream;
  if(VideoStream.instance) {
    if(VideoStream.instance.params == params) {
      stream = VideoStream.instance;
    } else {
      VideoStream.instance.destroy();
      stream = new VideoStream(params);
    }
  } else {
    stream = new VideoStream(params);
  }
  event.respondWith(stream.response(range));
}
