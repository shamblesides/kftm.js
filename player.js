const MAGIC_NUMBER = 'kftm'.split('').map((c,i) => c.charCodeAt(0) << (i * 8)).reduce((a,b) => a+b);
const SET_SPEED = 1;
const JUMP = 2;

function parseArrayBuffer(buf) {
  const data = new DataView(buf);
  const magicNumber = data.getUint32(0, true);
  if (magicNumber !== MAGIC_NUMBER) {
    throw new Error('This is not a KFTM file~')
  }
  const version = data.getUint16(4, true)
  if (version !== 1) {
    throw new Error(`I don't know how to read a version ${version} KFTM file!`);
  }
  const decoder = new TextDecoder('ascii', { fatal: true });
  const [title, composer, description] = [0, 1, 2].map(i => {
    const offset = 6 + 64 * i;
    const text = decoder.decode(buf.slice(offset, offset+64));
    const idx = text.indexOf('\x00');
    if (idx === -1) return text;
    return text.slice(0, idx);
  });
  document.querySelector('h2').innerText = title;
  document.querySelector('address').innerText = composer;
  document.querySelector('p').innerText = description;

  const rowCount = data.getUint16(6 + 3*64, true);
  const subRows = 8;

  let i = 6 + 3*64 + 2;
  const rows = Array(rowCount).fill().map(() => {
    const cmd = data.getUint16(i, true);
    i += 2;
    const arg = data.getFloat64(i, true);
    i += 8;
    const tracks = Array(subRows).fill().map(() => {
      const amp = data.getFloat64(i, true);
      i += 8;
      const freq = data.getFloat64(i, true);
      i += 8;
      return { amp, freq };
    })

    return { cmd, arg, tracks };
  });

  if (i !== buf.byteLength) {
    throw new Error(`Error! Read ${i} bytes, but filesize is ${buf.byteLength} bytes`)
  }
}

fetch('10thefunnynumbers.KFTM').then(x => x.arrayBuffer()).then(parseArrayBuffer).catch(err => alert(err.message));
