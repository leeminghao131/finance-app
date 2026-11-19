import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=file=>readFileSync(new URL("../src/"+file,import.meta.url),"utf8");
const app=read("App.jsx");
const css=read("financeCosmicPremium.css");
const scene=read("financeCosmicDeepSpace.svg");
const steel=read("financeHammeredSteel.svg");

test("PR57 regression: the tall dashboard MUST NOT scale expensive SVG background to its document height",()=>{
  assert.match(app,/className="mh-ui mh-cosmic-pilot min-h-screen/);
  const first=css.match(/\.mh-ui\.mh-cosmic-pilot\s*\{([^}]+)\}/);
  assert.ok(first,"scoped cosmic theme rule is retained");
  assert.match(first[1],/background-image:\s*url\("\.\/financeCosmicDeepSpace\.svg"\)/);
  assert.match(first[1],/background-size:\s*1920px 1200px/);
  assert.match(first[1],/background-attachment:\s*scroll/);
  assert.match(first[1],/background-repeat:\s*repeat/);
  assert.doesNotMatch(first[1],/background-size:\s*cover/);
  assert.doesNotMatch(first[1],/background-attachment:\s*fixed/);
  assert.doesNotMatch(css,/background-attachment:\s*fixed/);
});

test("PR57 perf: retain exact premium artwork and separate mobile density setting",()=>{
  assert.match(scene,/viewBox="0 0 1920 1200"/);
  assert.match(scene,/<filter id="nebulaBlur"/);
  assert.match(scene,/<filter id="planetSurface"/);
  assert.match(steel,/<filter id="grain"/);
  assert.match(css,/financeHammeredSteel\.svg/);
  assert.match(css,/financeOrnateBrassFrame\.svg/);
  assert.match(css,/@media \(max-width: 767px\)/);
  assert.match(css,/background-size:auto 980px/);
  assert.match(css,/\.mh-cosmic-top5__record/);
  assert.match(css,/\.mh-cosmic-heat__day/);
  // This performance fix must not touch cash-sensitive JS or add scroll handlers.
  assert.doesNotMatch(app,/addEventListener\(["']scroll["']/);
  assert.doesNotMatch(css,/will-change:\s*transform|content-visibility:\s*auto/);
});
