import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
const file=(name)=>readFileSync(new URL("../src/"+name,import.meta.url));
const css=file("financeCosmicPremium.css").toString("utf8");
const scene=file("financeCosmicDeepSpaceStatic.svg").toString("utf8");
const grain=file("financeHammeredSteelGrain.png");
test("active premium background has no GPU-expensive SVG filter primitives",()=>{
  assert.match(css,/background-image:\s*url\("\.\/financeCosmicDeepSpaceStatic\.svg"\)/);
  assert.doesNotMatch(css,/url\("\.\/financeCosmicDeepSpace\.svg"\)/);
  assert.match(scene,/viewBox="0 0 1920 1200"/);
  assert.match(scene,/Orbital \/ brass astrolabe/);
  assert.match(scene,/Large cropped Earth-like planet/);
  assert.match(scene,/nebulaPaint6/);
  assert.match(scene,/planetHaze/);
  assert.doesNotMatch(scene,/<filter\b|feTurbulence|feGaussianBlur|filter="url\(/i);
  assert.equal((scene.match(/<circle\b/g)||[]).length>=500,true,"original starfield and mechanical details preserved");
});
test("repeated metal grain is a baked RGBA PNG, not a runtime turbulence filter",()=>{
  assert.match(css,/financeHammeredSteelGrain\.png/g);
  assert.doesNotMatch(css,/url\("\.\/financeHammeredSteel\.svg"\)/);
  assert.deepEqual([...grain.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  assert.equal(grain.readUInt32BE(16),128);
  assert.equal(grain.readUInt32BE(20),128);
  assert.ok(grain.byteLength>60000 && grain.byteLength<130000);
  // Decode the real PNG payload so a truncated-but-valid-looking header cannot pass CI.
  let position=8, idat=[], seenIend=false;
  while (position+12<=grain.length) {
    const length=grain.readUInt32BE(position);
    const type=grain.toString("ascii",position+4,position+8);
    assert.ok(position+12+length<=grain.length,"PNG chunk cannot run past end of file");
    if (type==="IDAT") idat.push(grain.subarray(position+8,position+8+length));
    if (type==="IEND") { seenIend=true; position+=12+length; break; }
    position+=12+length;
  }
  assert.ok(seenIend && idat.length>0,"PNG includes image data and end marker");
  assert.equal(position,grain.length,"PNG has no trailing partial chunk");
  const pixels=inflateSync(Buffer.concat(idat));
  assert.equal(pixels.length,128*(1+128*4),"decoded pixel rows are complete");
  for(let row=0;row<128;row++) assert.equal(pixels[row*(1+128*4)],0,"expected PNG unfiltered RGBA row");
});
test("preserves nine-slice machinery, mobile layout and no financial logic modifications",()=>{
  assert.match(css,/financeOrnateBrassFrame\.svg/);
  assert.match(css,/background-size:\s*1920px 1200px/);
  assert.match(css,/@media \(max-width: 767px\)/);
  assert.match(css,/background-size:auto 980px/);
  assert.doesNotMatch(css,/background-attachment:\s*fixed/);
  assert.doesNotMatch(css,/https?:\/\/|@import|will-change:\s*transform/i);
});
