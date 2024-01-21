// Rather rudimentary MPEG schema
// Probably should be moved out as a separate module

const FourCC = {
  // Top-level
  0x66747970: {id: 'ftyp', cont: false},
  0x66726565: {id: 'free', cont: false},
  0x6D646174: {id: 'mdat', cont: false},
  0x6D6F6F76: {id: 'moov', cont: true},
  0x6D6F6F66: {id: 'moof', cont: true},
  0x6D667261: {id: 'mfra', cont: false},
  0x73696478: {id: 'sidx', cont: false},

  // MOOV children
  0x6D766864: {id: 'mvhd', cont: false},
  0x7472616B: {id: 'trak', cont: true, many: true},
  0x6D766578: {id: 'mvex', cont: true},
  0x75647461: {id: 'udta', cont: false},

  // MOOF children
  0x6D666864: {id: 'mfhd', cont: false, fullbox: true, fields: [
    [32, 'seqNum', 'uint']
  ]},
  0x74726166: {id: 'traf', cont: true, many: true},

  // TRAK children
  0x746B6864: {id: 'tkhd', cont: false, fullbox: true, fields: [
    [32, 'creationTime', 'uint',                    {cond: ['version', '=', 0]}],
    [32, 'modificationTime', 'uint',                {cond: ['version', '=', 0]}],
    [64, 'creationTime', 'uint',                    {cond: ['version', '=', 1]}],
    [64, 'modificationTime', 'uint',                {cond: ['version', '=', 1]}],
    [32, 'trackId', 'uint'],
    [32],
    [32, 'duration', 'uint',                        {cond: ['version', '=', 0]}],
    [64, 'duration', 'uint',                        {cond: ['version', '=', 1]}],
    [64],
    [16, 'layer', 'int',                            {template: 0}],
    [16, 'alternateGroup', 'int',                   {template: 0}],
    [16, 'volume', 'int'],
    [16],
    [32, 'matrix', 'int',                           {repeat: 9}],
    [32, 'width', 'uint'],
    [32, 'height', 'uint']
  ]},
  0x65647473: {id: 'edts', cont: true},
  0x6D646961: {id: 'mdia', cont: true},

  // TRAF children
  0x74666864: {id: 'tfhd', cont: false, fullbox: true, fields: [
    [32, 'trackId', 'uint'],
    [64, 'baseDataOffset', 'uint',                  {flag: 0x000001}],
    [32, 'sampleDescriptionIndex', 'uint',          {flag: 0x000002}],
    [32, 'defaultSampleDuration', 'uint',           {flag: 0x000008}],
    [32, 'defaultSampleSize', 'uint',               {flag: 0x000010}],
    [32, 'defaultSampleFlags', 'uint',              {flag: 0x000020}]
  ]},
  0x74666474: {id: 'tfdt', cont: false, fullbox: true, fields: [
    [32, 'baseMediaDecodeTime', 'uint',             {cond: ['version', '=', 0]}],
    [64, 'baseMediaDecodeTime', 'uint',           {cond: ['version', '=', 1]}]
  ]},
  0x7472756E: {id: 'trun', cont: false, fullbox: true, fields: [
    [32, 'sampleCount', 'uint'],
    [32, 'dataOffset', 'int',                       {flag: 0x000001}],
    [32, 'firstSampleFlags', 'uint',                {flag: 0x000004}],
    [-1, 'samples', [
      [32, 'duration', 'uint',                      {flag: 0x000100}],
      [32, 'size', 'uint',                          {flag: 0x000200}],
      [32, 'flags', 'uint',                         {flag: 0x000400}],
      [32, 'sampleCompositionTimeOffset', 'uint',   {flag: 0x000800, cond: ['version', '=', 0]}],
      [32, 'sampleCompositionTimeOffset', 'int',    {flag: 0x000800, cond: ['version', '!=', 0]}]
    ], {repeat: 'sampleCount'}]
  ]},

  // MDIA children
  0x6D646864: {id: 'mdhd', cont: false, fullbox: true, fields: [
    [32, 'creationTime', 'uint',                    {cond: ['version', '=', 0]}],
    [32, 'modificationTime', 'uint',                {cond: ['version', '=', 0]}],
    [64, 'creationTime', 'uint',                    {cond: ['version', '=', 1]}],
    [64, 'modificationTime', 'uint',                {cond: ['version', '=', 1]}],
    [32, 'timescale', 'uint'],
    [32, 'duration', 'uint',                        {cond: ['version', '=', 0]}],
    [64, 'duration', 'uint',                        {cond: ['version', '=', 1]}],
    [1],
    [5, 'language', 'int',                          {repeat: 3}],
    [16]
  ]},
  0x68646C72: {id: 'hdlr', cont: false},
  0x6D696E66: {id: 'minf', cont: true},

  // MINF children
  0x766D6864: {id: 'vmhd', cont: false},
  0x736D6864: {id: 'smhd', cont: false},
  0x64696E66: {id: 'dinf', cont: true},
  0x7374626C: {id: 'stbl', cont: true},

  // STBL children
  0x73747364: {id: 'stsd', cont: true, fullbox: true, fields: [
    [32, 'entryCount', 'uint']
  ]},
  0x73747473: {id: 'stts', cont: false, fullbox: true, fields: [
    [32, 'entryCount', 'uint'],
    [-1, 'entries', [
      [32, 'sampleCount', 'uint'],
      [32, 'sampleDelta', 'uint']
    ],                                              {repeat: 'entryCount'}]
  ]},
  0x73747373: {id: 'stss', cont: false, fullbox: true, fields: [
    [32, 'entryCount', 'uint'],
    [32, 'sampleNumber', 'uint',                    {repeat: 'entryCount'}]
  ]},
  0x63747473: {id: 'ctts', cont: false, fullbox: true, fields: [
    [32, 'entryCount', 'uint'],
    [-1, 'entries', [
      [32, 'sampleCount', 'uint'],
      [32, 'sampleOffset', 'uint']
    ],                                              {repeat: 'entryCount', cond: ['version', '=', 0]}],
    [-1, 'entries', [
      [32, 'sampleCount', 'uint'],
      [32, 'sampleOffset', 'int']
    ],                                              {repeat: 'entryCount', cond: ['version', '=', 1]}]
  ]},
  0x73747363: {id: 'stsc', cont: false, fullbox: true, fields: [
    [32, 'entryCount', 'uint'],
    [-1, 'entries', [
      [32, 'firstChunk', 'uint'],
      [32, 'samplesPerChunk', 'uint'],
      [32, 'sampleDescriptionIndex', 'uint']
    ],                                              {repeat: 'entryCount'}]
  ]},
  0x7374737A: {id: 'stsz', cont: false, fullbox: true, fields: [
    [32, 'sampleSize', 'uint'],
    [32, 'sampleCount', 'uint'],
    [-1, 'samples', [
      [32, 'size', 'uint']
    ],                                              {repeat: 'sampleCount', cond: ['sampleSize', '=', 0]}]
  ]},
  0x7374636F: {id: 'stco', cont: false, fullbox: true, fields: [
    [32, 'entryCount', 'uint'],
    [32, 'chunkOffset', 'uint',                     {repeat: 'entryCount'}]
  ]},
  0x73677064: {id: 'sgpd', cont: false},
  0x73626770: {id: 'sbgp', cont: false},

  // Other
  0x656C7374: {id: 'elst', cont: false},
  0x64726566: {id: 'dref', cont: false},
  0x61766331: {id: 'avc1', cont: false},
  0x74726578: {id: 'trex', cont: false, fullbox: true, fields: [
    [32, 'trackId', 'uint'],
    [32, 'defaultSampleDescriptionIndex', 'uint'],
    [32, 'defaultSampleDuration', 'uint'],
    [32, 'defaultSampleSize', 'uint'],
    [32, 'defaultSampleFlags', 'uint']
  ]}
} as any; // I'm not writing types for that

for(const code of Object.keys(FourCC)) {
  FourCC[FourCC[code].id] = parseInt(code);
}

function checkCond(options: any, fields: any, root: any): boolean {
  if(options && options.flag && !(root.flags & options.flag)) {
    return false;
  }
  if(options && options.cond) {
    const lhs = root[options.cond[0]];
    const op = options.cond[1];
    const rhs = options.cond[2];
    if((op == '=' && lhs != rhs) || (op == '!=' && lhs == rhs)) {
      return false;
    }
  }
  return true;
}

// Some boxes in MPEGs contain non-byte-aligned fields, but I don't need support them
// so reader/writer operates only on byte-aligned fields

function readFields(dv: DataView, schema: any, st: number, en: number, fields: any, root: any) {
  for(const [bitLen, name, type, options] of schema) {
    if(!checkCond(options, fields, root)) {
      continue;
    }

    if(name) {
      let count = 1;
      if(options && ('repeat' in options)) {
        count = typeof options.repeat == 'string' ? fields[options.repeat] : options.repeat;
        if(count > 0xffff) {
          throw new Error(`Number of repetitions is too big (${count})`);
        }
        fields[name] = [];
      }

      for(let i = 0; i < count && st < en; i++) {
        let value;
        if(Array.isArray(type)) {
          value = {};
          st = readFields(dv, type, st, en, value, root);
        } else {
          switch(type) {
            case 'int':
              switch(bitLen) {
                case 8: value = dv.getInt8(st); break;
                case 16: value = dv.getInt16(st); break;
                case 32: value = dv.getInt32(st); break;
              }
              break;
            case 'uint':
              switch(bitLen) {
                case 8: value = dv.getUint8(st); break;
                case 16: value = dv.getUint16(st); break;
                case 32: value = dv.getUint32(st); break;
              }
              break;
          }
          st += bitLen / 8;
        }
        if(options && ('repeat' in options)) {
          fields[name].push(value);
        } else {
          fields[name] = value;
        }
      }
    } else {
      st += bitLen / 8;
    }
  }
  return st;
}

function readMpegBoxes(dv: DataView, st = 0, en = -1): any {
  en = en == -1 ? dv.byteLength : en;
  const result = {
    st, en,
    buffer: dv.buffer,
    children: []
  } as any;
  while(st + 8 <= en) {
    const offs = st;
    const size = dv.getUint32(st);
    const fourcc = dv.getUint32(st + 4);
    if(size < 8 || offs + size > en) {
      console.warn(`Invalid box size: ${size}`);
    }
    st += 8;
    const box = {fourcc, st, en: offs + size, buffer: dv.buffer} as any;
    if(fourcc in FourCC) {
      const info = FourCC[fourcc];
      try {
        if(info.fullbox) {
          box.fields = {
            version: dv.getUint8(st),
            flags: (dv.getUint8(st + 1) << 16) | (dv.getUint16(st + 2))
          };
          st += 4;
        }
        if(info.fields) {
          box.fields = box.fields || {};
          st = readFields(dv, info.fields, st, box.en, box.fields, box.fields);
        }
        if(info.cont) {
          Object.assign(box, readMpegBoxes(dv, st, box.en));
        }
        if(info.many) {
          result['$' + info.id] = result['$' + info.id] || [];
          result['$' + info.id].push(box);
        } else {
          result['$' + info.id] = box;
        }
      } catch(e) {
        console.warn(`Unable to decode "${info.id}" box @ ${offs}:`, e);
        box.error = e;
      }
    }
    st = offs + Math.max(size, 8);
    result.children.push(box);
  }
  return result;
}

function measureFields(schema: any, fields: any, root: any) {
  let total = 0;
  for(const [bitLen, name, type, options] of schema) {
    if(!checkCond(options, fields, root)) {
      continue;
    }

    if(name) {
      const values = (options && ('repeat' in options)) ? fields[name] : [fields[name]];
      for(const value of values) {
        if(Array.isArray(type)) {
          total += measureFields(type, value, root);
        } else {
          total += bitLen / 8;
        }
      }
    } else {
      total += bitLen / 8;
    }
  }
  return total;
}

function writeFields(dv: DataView, schema: any, st: number, fields: any, root: any): number {
  for(const [bitLen, name, type, options] of schema) {
    if(!checkCond(options, fields, root)) {
      continue;
    }

    if(name) {
      const values = (options && ('repeat' in options)) ? fields[name] : [fields[name]];
      for(const value of values) {
        if(Array.isArray(type)) {
          st = writeFields(dv, type, st, value, root);
        } else {
          switch(type) {
            case 'int':
              switch(bitLen) {
                case 8: dv.setInt8(st, value); break;
                case 16: dv.setInt16(st, value); break;
                case 32: dv.setInt32(st, value); break;
              }
              break;
            case 'uint':
              switch(bitLen) {
                case 8: dv.setUint8(st, value); break;
                case 16: dv.setUint16(st, value); break;
                case 32: dv.setUint32(st, value); break;
              }
              break;
          }
          st += bitLen / 8;
        }
      }
    } else {
      st += bitLen / 8;
    }
  }
  return st;
}

function writeMpegBoxes(boxes: any[], bufs: ArrayBuffer[] = []): [ArrayBuffer[], number] {
  let total = 0;
  for(const box of boxes) {
    if(box.buffer) {
      total += box.en - box.st + 8;
      bufs.push(box.buffer.slice(box.st - 8, box.en));
      continue;
    }
    let size = 8;
    let cbufs: ArrayBuffer[] = [];
    let csize = 0;
    if(box.fourcc in FourCC) {
      const info = FourCC[box.fourcc];
      if(info.fullbox) {
        size += 4;
      }
      if(info.fields) {
        size += measureFields(info.fields, box.fields, box.fields);
      }
    }
    if(box.children) {
      [cbufs, csize] = writeMpegBoxes(box.children);
    }

    const buf = new ArrayBuffer(size);
    const dv = new DataView(buf);
    dv.setUint32(0, size + csize);
    dv.setUint32(4, box.fourcc);

    if(box.fourcc in FourCC) {
      const info = FourCC[box.fourcc];
      let st = 8;
      if(info.fullbox) {
        dv.setUint8(st, box.fields.version);
        dv.setUint8(st + 1, box.fields.flags >> 16);
        dv.setUint16(st + 2, box.fields.flags & 0xffff);
        st += 4;
      }
      if(info.fields) {
        writeFields(dv, info.fields, st, box.fields, box.fields);
      }
    }

    bufs.push(buf);
    bufs = bufs.concat(cbufs);
    total += size + csize;
  }
  return [bufs, total];
}

function makeBox(fourcc: number, fields: any, children: any = null): any {
  if(Array.isArray(fields) && !children) {
    return {fourcc, children: fields};
  }
  return children ? {fourcc, fields, children} : {fourcc, fields};
}

// Converts a sequence of basic (non-fragmented) MPEGs to an infinite fragmented one
export default class FragmentedMpeg {
  private inited = false;
  private seqNum = 1;
  private trackDurations: any = {};

  private appendInitialChunk(boxes: any): ArrayBuffer[] {
    this.inited = true;
    for(const trak of boxes.$moov.$trak) {
      // TODO: Check if this is correct (or should we sum all samples' durations)
      this.trackDurations[trak.$tkhd.fields.trackId] = trak.$mdia.$mdhd.fields.duration;
    }
    return writeMpegBoxes(boxes.children.map((box: any) => {
      // We need to add MVEX/TREX boxes to indicate that we will append fragments later
      if(box.fourcc == FourCC.moov) {
        return makeBox(FourCC.moov, [
          ...box.children,
          makeBox(FourCC.mvex,
            box.$trak.map((trak: any) => makeBox(FourCC.trex, {
              trackId: trak.$tkhd.fields.trackId,
              defaultSampleDescriptionIndex: 1,
              defaultSampleDuration: 0,
              defaultSampleSize: 0,
              defaultSampleFlags: 0
            }))
          )
        ]);
      }
      return box;
    }))[0];
  }

  private appendSubsequentChunk(boxes: any): ArrayBuffer[] {
    const buffers = writeMpegBoxes([
      boxes.$mdat, // Actual sample data
      makeBox(FourCC.moof, [
        makeBox(FourCC.mfhd, {seqNum: this.seqNum}),
        ...boxes.$moov.$trak.map((trak: any) => {
          const isAudio = !!trak.$mdia.$minf.$smhd; // Not the cleanest way
          const compOffsetsPresent = !!trak.$mdia.$minf.$stbl.$ctts;
          const defaultSampleFlags = isAudio ? 0x2000000 : 0x1010000;
          const sampleSizes = trak.$mdia.$minf.$stbl.$stsz.fields.samples;
          const hasEqualSizes = !sampleSizes;

          // Unfortunately, the source videos contain interleaved audio/video samples
          // So we have to create a separate 'trun' box for each chunk (it only supports contigious runs of samples)

          const truns = trak.$mdia.$minf.$stbl.$stco.fields.chunkOffset.map((offset: number) => makeBox(FourCC.trun, {
            version: 0, flags: 0x000001 | 0x000100 |
              (hasEqualSizes ? 0x000000 : 0x000200) |
              (compOffsetsPresent ? 0x000800 : 0x000000),
            sampleCount: 0,
            dataOffset: (offset - boxes.$mdat.st) - (boxes.$mdat.en - boxes.$mdat.st),
            samples: []
          }));

          const chunkRuns = trak.$mdia.$minf.$stbl.$stsc.fields.entries;
          const samples: any[] = [];
          const sampleRun: any[] = [];
          for(let i = 0; i < chunkRuns.length; i++) {
            const nextChunk = i < chunkRuns.length - 1 ? chunkRuns[i + 1].firstChunk : (truns.length + 1);
            for(let j = chunkRuns[i].firstChunk; j < nextChunk; j++) {
              for(let k = 0; k < chunkRuns[i].samplesPerChunk; k++) {
                const sample = {
                  flags: defaultSampleFlags
                };
                samples.push(sample);
                sampleRun.push(truns[j - 1]);
                truns[j - 1].fields.sampleCount += 1;
                truns[j - 1].fields.samples.push(sample);
              }
            }
          }

          if(!hasEqualSizes) {
            for(let i = 0; i < sampleSizes.length; i++) {
              samples[i].size = sampleSizes[i].size;
            }
          }

          let i = 0;
          for(const entry of trak.$mdia.$minf.$stbl.$stts.fields.entries) {
            for(let j = i; j < i + entry.sampleCount; j++) {
              samples[j].duration = entry.sampleDelta;
            }
            i += entry.sampleCount;
          }

          if(!isAudio) { // This is not the proper way to compute flags. Will break if underlying encoding format is changed
            truns[0].fields.flags |= 0x000004;
            truns[0].fields.firstSampleFlags = 1 << 25;
          }

          if(compOffsetsPresent) {
            let i = 0;
            for(const entry of trak.$mdia.$minf.$stbl.$ctts.fields.entries) {
              for(let j = i; j < i + entry.sampleCount; j++) {
                samples[j].sampleCompositionTimeOffset = entry.sampleOffset;
              }
              i += entry.sampleCount;
            }
          }

          return makeBox(FourCC.traf, [
            makeBox(FourCC.tfhd, {
              version: 0, flags: (hasEqualSizes ? 0x000010 : 0x000000) | 0x000020 | 0x020000,
              trackId: trak.$tkhd.fields.trackId,
              defaultSampleSize: hasEqualSizes ? trak.$mdia.$minf.$stbl.$stsz.fields.sampleSize : 0,
              defaultSampleFlags: isAudio ? 0 : 0x10000
            }),
            makeBox(FourCC.tfdt, {
              version: 0, flags: 0,
              baseMediaDecodeTime: this.trackDurations[trak.$tkhd.fields.trackId]
            }),
            // Not sure if we need to copy SGPD/SBGP boxes directly (or how to process them at all)
            ...(trak.$mdia.$minf.$stbl.$sgpd ? [trak.$mdia.$minf.$stbl.$sgpd] : []),
            ...(trak.$mdia.$minf.$stbl.$sbgp ? [trak.$mdia.$minf.$stbl.$sbgp] : []),
            ...truns
          ]);
        })
      ])
    ])[0];

    // Update state for future chunks
    for(const trak of boxes.$moov.$trak) {
      const isAudio = !!trak.$mdia.$minf.$smhd; // Not the cleanest way
      let computed = 0;
      for(const entry of trak.$mdia.$minf.$stbl.$stts.fields.entries) {
        computed += entry.sampleCount * entry.sampleDelta;
      }
      console.log(isAudio ? 'audio track duration ' : 'video track duration ', trak.$mdia.$mdhd.fields.duration, ', computed ', computed, ', expected ~', isAudio ? 48000 : 16000);
      this.trackDurations[trak.$tkhd.fields.trackId] += isAudio ? 48000 : 16000; // computed; // trak.$mdia.$mdhd.fields.duration; // isAudio ? 48000 : 16000; //
    }
    this.seqNum += 1;
    return buffers;
  }

  // Feed another MPEG, retrieve corresponding buffers
  public appendChunk(chunk: ArrayBufferLike): ArrayBuffer[] {
    const boxes = readMpegBoxes(new DataView(chunk));
    if(!this.inited) {
      return this.appendInitialChunk(boxes);
    }
    return this.appendSubsequentChunk(boxes);
  }
}
