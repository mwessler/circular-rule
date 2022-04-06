/*
 * Circular-rule: a zoomable circular slide rule.
 * Inspired/requested by Mathologer: https://www.youtube.com/watch?v=ZIQQvxSXLhI
 *
 * Note: this is quick-and-dirty coding, meant to get out as quickly as possible.
 */

window.onload=() => start();

let tracking = {};  // id => {part: 'inner' | 'outer', moved: boolean, ang} OR {part: 'gesture', other: pointerId, startingDist}
let ctrx;
let ctry;
let wid;
let hgt;
let radius;
let wheeltop = 1;
let wheeloffset = 1;
const factor = Math.PI*2 / Math.log(10);
let animate = undefined;
let zoom = 1;
let op = 1;
const phi = (Math.sqrt(5)-1)/2;
const maxzoom = 1213000000000;

function start() {
  try {
    const canv = document.getElementById('canvas');
    wid = canv.getAttribute('width');
    hgt = canv.getAttribute('height');
    radius = hgt*0.40;
    ctrx = wid/2 + 0.5;
    ctry = hgt/2;
    canv.onpointerdown = (evt) => {startTracking(evt); };
    canv.onpointermove = (evt) => {handleMove(evt); };
    canv.onpointerup = (evt) => {stopTracking(evt); };
    canv.onwheel = (evt) => {handleScroll(evt); };
    document.getElementById('op1').onkeyup = () => spin(1);
    document.getElementById('op2').onkeyup = () => spin(2);
    document.getElementById('prod').onkeyup = () => spin(3);
    document.getElementById('mode').onchange = changeMode;
    draw();
  }
  catch (e) {
    debug(e.stack);
  }
}

function changeMode(evt) {
  const pickop = evt.target.value;
  if (pickop === 'div') {
    op = -1;
    document.getElementById('op').innerHTML = '&divide;';
  }
  else {
    op = 1;
    document.getElementById('op').innerHTML = '&times;';
  }
  draw();
  if (op === 1) {
    document.getElementById('op2').value = wheeloffset;
  }
  else {
    document.getElementById('op2').value = 1/wheeloffset;
  }
}

function handleScroll(evt) {
  const amt = evt.deltaY;
  evt.stopPropagation();
  evt.preventDefault();
  changeZoom(Math.pow(1.001, amt));
}

function changeZoom(amt) {
  zoom *= amt;
  if (zoom < 1) {
    zoom = 1;
  }
  if (zoom > maxzoom) {
    zoom = maxzoom;
  }
  // at zoom=1, radius = hgt*0.4; ctry = hgt*0.5
  radius = zoom*hgt*0.4;
  ctry = hgt*(zoom)/(2*zoom + 8) + radius;
  draw();
}

function startTracking(evt) {
  evt.stopPropagation();
  evt.preventDefault();
  if (!tracking[evt.pointerId]) {
    const {part, ang} = getPartAndAngle(evt.offsetX, evt.offsetY);
    evt.target.setPointerCapture(evt.pointerId);
    // is there another pointer with the same part?
    for (const other of Object.keys(tracking)) {
      if (tracking[other].part === part) {
        // make them both gesture
        const startingDist = 1;
        tracking[evt.pointerId]= {part: 'gesture', other, x: evt.offsetX, y: evt.offsetY};
        tracking[other] = {part: 'gesture', other: evt.pointerId, x: tracking[other].x, y: tracking[other].y};
        return;
      }
    }
    tracking[evt.pointerId] = {part, ang, moved: false, x: evt.offsetX, y: evt.offsetY};
  }
}

function stopTracking(evt) {
  evt.stopPropagation();
  evt.preventDefault();
  if (!tracking[evt.pointerId]) {
    return;
  }
  evt.target.releasePointerCapture(evt.pointerId);
  if (!tracking[evt.pointerId].moved) {
    // it was a click
    handleRound(evt);
  }
  delete tracking[evt.pointerId];
}

function handleMove(evt) {
  evt.stopPropagation();
  evt.preventDefault();
  const tracker = tracking[evt.pointerId];
  if (!tracker) {
    return;
  }
  tracker.moved = true;
  if (tracker.part === 'gesture') {
    // it's a zoom
    const dx1 = evt.offsetX - tracking[tracker.other].x;
    const dy1 = evt.offsetY - tracking[tracker.other].y;
    const dx2 = tracker.x - tracking[tracker.other].x;
    const dy2 = tracker.y - tracking[tracker.other].y;
    const dist1 = Math.sqrt(dx1*dx1 + dy1*dy1);
    const dist2 = Math.sqrt(dx2*dx2 + dy2*dy2);
    changeZoom(dist1/dist2);
    tracker.x = evt.offsetX;
    tracker.y = evt.offsetY;
    return;
  }
  const track = getPartAndAngle(evt.offsetX, evt.offsetY);
  let dang = tracker.ang - track.ang;
  if (dang < -Math.PI) {
    dang += Math.PI*2;
  }
  else if (dang > Math.PI) {
    dang -= Math.PI*2;
  }
  const moveAmt = Math.exp(dang/factor);
  if (tracker.part === 'outer') {
    wheeltop *= moveAmt;
    for (const other of Object.keys(tracking)) {
      if (tracking[other].part === 'inner') {
        // some other finger is tracking inner.  Undo the implicit spin
        wheeloffset /= moveAmt;
        break;
      }
    }
  }
  else {
    wheeloffset *= moveAmt;
  }
  tracker.ang = track.ang;
  tracker.x = evt.offsetX;
  tracker.y = evt.offsetY;
  document.getElementById('op1').value = wheeltop;
  document.getElementById('op2').value = op === 1 ? wheeloffset : 1/wheeloffset;
  document.getElementById('prod').value = wheeltop * wheeloffset;
  draw();
}

function handleRound(evt) {
  evt.stopPropagation();
  evt.preventDefault();
  const {ang, part} = getPartAndAngle(evt.offsetX, evt.offsetY);
  if (part === 'outer') {
    wheeltop = roundIt(wheeltop);
  }
  else {
    if (op === 1) {
      wheeloffset = roundIt(wheeloffset);
    }
    else {
      wheeloffset = 1/roundIt(1/wheeloffset);
    }
  }
  document.getElementById('op1').value = wheeltop;
  document.getElementById('op2').value = op === 1 ? wheeloffset : 1/wheeloffset;
  document.getElementById('prod').value = wheeltop * wheeloffset;
  draw();
}

function roundIt(val) {
  const decimals = Math.pow(10, Math.floor(Math.log10(val)));
  const precision = Math.floor(Math.log10(zoom)+1);
  const number = Number(val/decimals).toFixed(precision) * decimals;
  console.log(val + ' => ' + number);
  return number;
}

function spin(which) {
  const goffset = op === 1
    ? Math.abs(parseFloat(document.getElementById('op2').value))
    : 1/Math.abs(parseFloat(document.getElementById('op2').value));
  const gtop = which === 3
    ? Math.abs(parseFloat(document.getElementById('prod').value)) / goffset
    : Math.abs(parseFloat(document.getElementById('op1').value));
  if (gtop <= 0 || goffset <= 0) {
    return;
  }
  const dtop = gtop/wheeltop;
  const doffset = goffset/wheeloffset;
  if (isNaN(dtop) || isNaN(doffset) || !isFinite(dtop) || !isFinite(doffset)) {
    return;
  }
  let again = false;
  if (Math.abs(dtop-1)<0.001/zoom) {
    wheeltop = gtop;
  }
  else {
    wheeltop = wheeltop * Math.pow(dtop, 0.1);
    again = true;
  }
  if (Math.abs(doffset-1)<0.001/zoom) {
    wheeloffset = goffset;
  }
  else {
    wheeloffset = wheeloffset * Math.pow(doffset, 0.1);
    again = true;
  }
  draw();
  if (which === 3) {
    document.getElementById('op1').value = wheeltop;
  }
  else {
    document.getElementById('prod').value = wheeltop * wheeloffset;
  }
  if (again) {
    clearTimeout(animate);
    animate = setTimeout(() => spin(which), 10);
  }
  else {
    animate = undefined;
  }
}

function getPartAndAngle(x, y) {
  const dy = y-ctry;
  const dx = x-ctrx;
  const ang = Math.atan2(dy, dx);
  const part = (dy*dy + dx*dx > radius*radius) ? 'outer' : 'inner';
  return {
    ang,
    part
  };
}

function debug(str) {
  document.getElementById('debug').innerText = str;
}

function draw() {
  const canv = document.getElementById('canvas');
  const g2 = canv.getContext('2d');

  g2.fillStyle='white';
  g2.fillRect(0, 0, wid, hgt);

  calculateTicks(g2, wheeltop, radius, 1, 1, 0);
  calculateTicks(g2, wheeltop*wheeloffset, radius, -1, 1, 0);

  g2.strokeStyle = 'rgba(255, 0, 0, 0.5)';
  g2.beginPath();
  g2.moveTo(ctrx, ctry-radius + 50);
  g2.lineTo(ctrx, ctry-radius - 50);
  g2.stroke();

  g2.strokeStyle = 'rgba(0, 255, 0, 0.1)';
  g2.lineWidth = 20;
  g2.lineCap = 'butt';
  g2.beginPath();
  g2.moveTo(ctrx, ctry-radius);
  g2.lineTo(ctrx, ctry-radius + 60);
  g2.stroke();

  g2.beginPath();
  g2.moveTo(ctrx, ctry-radius);
  g2.lineTo(ctrx, ctry-radius - 60);
  g2.strokeStyle = 'rgba(255, 0, 0, 0.1)';
  g2.stroke();

  const ang = op === 1
    ? -Math.log(wheeltop) * factor - Math.PI/2
    : -Math.log(wheeltop*wheeloffset) * factor - Math.PI/2 ;
  const sin = Math.sin(ang);
  const cos = Math.cos(ang);
  g2.beginPath();
  g2.moveTo(ctrx + cos*radius, ctry + sin*radius);
  g2.lineTo(ctrx + cos*(radius - op*60), ctry + sin*(radius - op*60));
  g2.strokeStyle = 'rgba(0, 0, 255, 0.1)';
  g2.stroke();

  g2.lineWidth = 1;
}

function calculateTicks(g2, ctrv, radius, isInner, from, scale) {
  g2.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  g2.fillStyle = 'black';
  const offsetAng = Math.log(ctrv) * factor + Math.PI/2;

  let by = Math.pow(0.1, scale);
  let prevAng = Math.log(from) * factor - offsetAng;
  let prevVal = from;
  let prevCos = Math.cos(prevAng);

  const limit = Math.log((from+by)/from)*factor*radius;
  const step = limit < 1 ? 5 : limit < 2 ? 2 : 1;

  for (let i=step; i <= (scale === 0 ? 9 : 10); i+= step) {
    const val = from + i*by;
    const ang = Math.log(val) * factor - offsetAng;

    const pronglevel = (i===5 ? 2 : i%2===0 ? 1 : 0);
    const prong = scale*3 - pronglevel;
    const len = Math.min(34* zoom * (scale > 0 ? Math.pow(0.477, prong) : 1), ctry-radius-20);
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);

    if (i!= 10) {
      if (val === 10 && scale === 0 && isInner === op) {
        g2.strokeStyle = 'blue';
      }
      else {
        g2.strokeStyle = 'black';
      }
      g2.beginPath();
      g2.moveTo(ctrx + cos*radius, ctry + sin*radius);
      g2.lineTo(ctrx + cos*(radius+len*isInner), ctry + sin*(radius+len*isInner));
      g2.stroke();
      if (limit/(4-pronglevel) + len/3 > 5+(scale)*4) {
        g2.font = scale === 0 ? '24px sans-serif' : '12px sans-serif';
        g2.textAlign = 'center';
        g2.fillStyle = (val === 10 && scale === 0 && isInner === op) ? 'blue' : 'black';
        const str = Number(val === 10 ? 1 : val).toFixed(scale);
        g2.fillText('' + str, ctrx + cos*(radius+(len+10)*isInner), ctry + sin*(radius+(len+10)*isInner)+5);
      }
    }

    if ((ang-prevAng) * radius > 4 && (scale === 0 || ctrx + prevCos*radius <= wid && ctrx + cos*radius >= 0)) {
      calculateTicks(g2, ctrv, radius, isInner, prevVal, scale+1);
    }
    prevVal = val;
    prevAng = ang;
  }
}
