function scanEsdsDescriptors(dv: DataView, offs: number, en: number): boolean {
  while(offs + 2 <= en) {
    const tag = dv.getUint8(offs++);
    let len = 0;
    while(true) { // Read base128-encoded length
      const byte = dv.getUint8(offs++);
      len = (len << 7) | (byte & 0x7F);
      if(!(byte & 0x80)) {
        break;
      }
    }
    const st = offs;
    // console.log('found tag ', tag, ', len = ', len);
    if(tag == 0x03) { // ES Descriptor (root)
      offs += 2;
      const flags = dv.getUint8(offs++);
      if(flags & 0x80) { // Stream Dependence flag
        offs += 2;
      }
      if(flags & 0x40) { // URL flag
        const urlLength = dv.getUint8(offs++);
        offs += urlLength;
      }
      if(flags & 0x20) { // OCR Stream flag
        offs += 2;
      }
      if(scanEsdsDescriptors(dv, offs, st + len)) {
        return true;
      }
    } else if(tag == 0x04) { // Decoder Config Descriptor
      offs += 13;
      if(scanEsdsDescriptors(dv, offs, st + len)) {
        return true;
      }
    } else if(tag == 0x05) { // Decoder Specific Info (Audio Specific Configuration)
      offs += 1;
      const byte = dv.getUint8(offs);
      const channelConfiguration = (byte >> 3) & 0b11;
      if(channelConfiguration != 1) { // Should be 1, something is wrong (unable to patch)
        return false;
      }
      dv.setUint8(offs, (byte & 0b11100111) | (2 << 3)); // Change channelConfiguration from 1 to 2
      return true; // Patch successful
    }
    offs = st + len;
  }
  return false; // ASC was not found (or channelConfiguration was not 1), unable to patch
}

function scanMpegBoxes(dv: DataView, offs: number, en: number): boolean {
  while(offs + 8 <= en) {
    const st = offs;
    const len = dv.getUint32(offs);
    offs += 4;
    const fourcc = dv.getUint32(offs);
    // console.log(offs, 'found ' + (new TextDecoder('utf-8')).decode(dv.buffer.slice(offs, offs + 4)));
    offs += 4;
    if(fourcc == 0x65736473) {
      // 'esds'
      offs += 4;
      if(scanEsdsDescriptors(dv, offs, st + len)) {
        return true;
      }
    } else if([0x6D6F6F76, 0x7472616B, 0x6D646961, 0x6D696E66, 0x7374626C, 0x73747364, 0x6d703461].includes(fourcc)) {
      // 'moov', 'trak', 'mdia', 'minf', 'stbl', 'stsd', 'mp4a'
      if(fourcc == 0x73747364) { // stsd
        offs += 8;
      } else if(fourcc == 0x6d703461) { // mp4a
        offs += 28;
      }
      if(scanMpegBoxes(dv, offs, st + len)) {
        return true;
      }
    }
    offs = st + len;
  }
  return false;
}

export default async function patchVideo(url: string): Promise<Uint8Array | null> {
  const buffers = new Array<ArrayBuffer>();
  let totalLen = 0;
  while(true) {
    const buffer = await (await fetch(url, {
      headers: {
        'range': `bytes=${totalLen}-`
      }
    })).arrayBuffer();

    totalLen += buffer.byteLength;
    if(!buffer.byteLength) {
      break;
    }
    buffers.push(buffer);
  }
  const data = new Uint8Array(totalLen);
  for(let i = 0, offs = 0; i < buffers.length; offs += buffers[i].byteLength, i++) {
    data.set(new Uint8Array(buffers[i]), offs);
  }
  const dv = new DataView(data.buffer);
  if(scanMpegBoxes(dv, 0, dv.byteLength)) {
    return data;
  }
  return null;
}
