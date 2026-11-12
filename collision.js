// Lightweight, deterministic 2D furniture collision for the AR floor plane.
// Units: metres. Coordinates follow Three.js rotation around Y (+angle turns +X towards -Z).
// Tabletop decor (including the crystal table lamp) must be free to overlap
// the table's floor footprint so it can snap onto its top surface.
export const FLOOR_SOLIDS = Object.freeze([0, 1, 2, 3, 6, 8, 9, 10, 11, 12, 13, 15, 22, 23, 24, 25, 26, 27, 29, 30, 32, 1000]);
const EPS = 1e-9;
const CLEARANCE = 0.012; // 1.2 cm of breathing room between solid footprints.

export function isFloorSolid(index) { return FLOOR_SOLIDS.includes(index); }
export function footprint(size, x, z, angle = 0) {
  return { x, z, angle, hx: size[0] / 2, hz: size[2] / 2 };
}
const axes = b => {
  const c = Math.cos(b.angle), s = Math.sin(b.angle);
  return [[c, -s], [s, c]];
};
const projectionRadius = (box, ax, az) => {
  const c = Math.cos(box.angle), s = Math.sin(box.angle);
  return box.hx * Math.abs(c * ax - s * az) + box.hz * Math.abs(s * ax + c * az);
};

export function footprintsOverlap(a, b, clearance = CLEARANCE) {
  for (const [ax, az] of [...axes(a), ...axes(b)]) {
    const distance = Math.abs((a.x - b.x) * ax + (a.z - b.z) * az);
    if (distance >= projectionRadius(a, ax, az) + projectionRadius(b, ax, az) + clearance - EPS) return false;
  }
  return true;
}

// Exact swept SAT for a translated, rotated rectangle. Prevents tunnelling on fast pointer moves.
function firstContact(start, goal, fixed) {
  const dx = goal.x - start.x, dz = goal.z - start.z;
  if (dx * dx + dz * dz < EPS) return null;
  let enter = -Infinity, exit = Infinity, normal = null;
  for (const [ax, az] of [...axes(start), ...axes(fixed)]) {
    const p = (start.x - fixed.x) * ax + (start.z - fixed.z) * az;
    const v = dx * ax + dz * az;
    const r = projectionRadius(start, ax, az) + projectionRadius(fixed, ax, az) + CLEARANCE;
    if (Math.abs(v) < EPS) {
      if (Math.abs(p) > r) return null;
      continue;
    }
    const a = (-r - p) / v, b = (r - p) / v;
    const near = Math.min(a, b), far = Math.max(a, b);
    if (near > enter) {
      enter = near;
      const side = p + v * near >= 0 ? 1 : -1;
      normal = { x: ax * side, z: az * side };
    }
    exit = Math.min(exit, far);
    if (enter > exit) return null;
  }
  if (exit <= 0 || enter >= 1 || !normal) return null;
  return { time: Math.max(0, enter), normal };
}

export function moveWithoutOverlap(moving, goal, obstacles) {
  if (![moving.x, moving.z, goal.x, goal.z].every(Number.isFinite)) return { x: moving.x, z: moving.z };
  let current = { ...moving }, remaining = { x: goal.x - moving.x, z: goal.z - moving.z };
  // Older saved layouts can start overlapped. Allow escape instead of trapping the item.
  const blockers = obstacles.filter(other => !footprintsOverlap(moving, other));
  for (let iteration = 0; iteration < 3; iteration++) {
    const length = Math.hypot(remaining.x, remaining.z);
    if (length < 0.0001) break;
    const target = { ...current, x: current.x + remaining.x, z: current.z + remaining.z };
    let first = null;
    for (const item of blockers) {
      const contact = firstContact(current, target, item);
      if (contact && (!first || contact.time < first.time)) first = contact;
    }
    if (!first) { current = target; break; }
    const fraction = Math.max(0, first.time - 0.002 / length);
    current.x += remaining.x * fraction;
    current.z += remaining.z * fraction;
    // Project remaining motion on the collision tangent. This allows sliding, not snapping.
    const rest = 1 - fraction;
    const vx = remaining.x * rest, vz = remaining.z * rest;
    const intoWall = Math.min(0, vx * first.normal.x + vz * first.normal.z);
    remaining = { x: vx - intoWall * first.normal.x, z: vz - intoWall * first.normal.z };
    if (Math.abs(intoWall) < EPS) break;
  }
  return { x: current.x, z: current.z };
}

// Translate a tabletop and its linked chairs as a single rigid group.
export function moveGroupWithoutOverlap(movers, goal, obstacles) {
  if (!movers.length) return goal;
  const anchor = movers[0];
  if (![anchor.x, anchor.z, goal.x, goal.z].every(Number.isFinite)) return { x: anchor.x, z: anchor.z };
  const active = movers.map(m => obstacles.filter(b => !footprintsOverlap(m, b)));
  let shiftX = 0, shiftZ = 0;
  let remaining = { x: goal.x - anchor.x, z: goal.z - anchor.z };
  for (let iteration = 0; iteration < 3; iteration++) {
    const length = Math.hypot(remaining.x, remaining.z);
    if (length < .0001) break;
    let first = null;
    for (let i = 0; i < movers.length; i++) {
      const base = movers[i];
      const start = { ...base, x: base.x + shiftX, z: base.z + shiftZ };
      const target = { ...start, x: start.x + remaining.x, z: start.z + remaining.z };
      for (const blocker of active[i]) {
        const contact = firstContact(start, target, blocker);
        if (contact && (!first || contact.time < first.time)) first = contact;
      }
    }
    if (!first) { shiftX += remaining.x; shiftZ += remaining.z; break; }
    const fraction = Math.max(0, first.time - .002 / length);
    shiftX += remaining.x * fraction; shiftZ += remaining.z * fraction;
    const vx = remaining.x * (1 - fraction), vz = remaining.z * (1 - fraction);
    const into = Math.min(0, vx * first.normal.x + vz * first.normal.z);
    remaining = { x: vx - into * first.normal.x, z: vz - into * first.normal.z };
    if (Math.abs(into) < EPS) break;
  }
  return { x: anchor.x + shiftX, z: anchor.z + shiftZ };
}

function rotatedGroupShape(shape, anchor, delta) {
  const dx = shape.x - anchor.x, dz = shape.z - anchor.z;
  const c = Math.cos(delta), s = Math.sin(delta);
  return { ...shape, x: anchor.x + dx * c + dz * s, z: anchor.z - dx * s + dz * c, angle: shape.angle + delta };
}

export function rotateGroupWithoutOverlap(movers, desiredAngle, obstacles) {
  if (!movers.length) return desiredAngle;
  const anchor = movers[0], delta = desiredAngle - anchor.angle;
  if (!Number.isFinite(delta) || Math.abs(delta) < EPS) return anchor.angle;
  const active = movers.map(m => obstacles.filter(b => !footprintsOverlap(m, b)));
  const blocked = angle => movers.some((shape, i) => {
    const test = rotatedGroupShape(shape, anchor, angle - anchor.angle);
    return active[i].some(b => footprintsOverlap(test, b));
  });
  const steps = Math.min(72, Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 36))));
  let safe = anchor.angle;
  for (let i = 1; i <= steps; i++) {
    const angle = anchor.angle + delta * i / steps;
    if (blocked(angle)) {
      let low = safe, high = angle;
      for (let j = 0; j < 9; j++) {
        const mid = (low + high) / 2;
        if (blocked(mid)) high = mid;
        else low = mid;
      }
      return low;
    }
    safe = angle;
  }
  return desiredAngle;
}

export function rotateWithoutOverlap(moving, desiredAngle, obstacles) {
  if (!Number.isFinite(desiredAngle)) return moving.angle;
  const delta = desiredAngle - moving.angle;
  if (Math.abs(delta) < EPS) return moving.angle;
  const blockers = obstacles.filter(other => !footprintsOverlap(moving, other));
  if (!blockers.length) return desiredAngle;
  // Sample short angular arcs so a thin object cannot be jumped over during a 45-degree turn.
  const steps = Math.min(72, Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 36))));
  let safe = moving.angle;
  for (let i = 1; i <= steps; i++) {
    const angle = moving.angle + delta * i / steps;
    if (blockers.some(b => footprintsOverlap({ ...moving, angle }, b))) {
      let low = safe, high = angle;
      for (let j = 0; j < 9; j++) {
        const mid = (low + high) / 2;
        if (blockers.some(b => footprintsOverlap({ ...moving, angle: mid }, b))) high = mid;
        else low = mid;
      }
      return low;
    }
    safe = angle;
  }
  return desiredAngle;
}

// For additions only: choose a nearby free spot; never teleport an already-grabbed object.
export function nearestFreeFootprint(candidate, obstacles, maxRadius = 1.8) {
  if (!obstacles.some(b => footprintsOverlap(candidate, b))) return { x: candidate.x, z: candidate.z };
  for (let radius = .15; radius <= maxRadius + EPS; radius += .15) {
    const directions = Math.max(16, Math.ceil(2 * Math.PI * radius / .24));
    for (let i = 0; i < directions; i++) {
      const theta = 2 * Math.PI * i / directions;
      const test = { ...candidate, x: candidate.x + radius * Math.cos(theta), z: candidate.z + radius * Math.sin(theta) };
      if (!obstacles.some(b => footprintsOverlap(test, b))) return { x: test.x, z: test.z };
    }
  }
  return null;
}

/** At release, separate overlapping floor rectangles, moving smaller ones more. */
export function settleFootprintsBySize(source,maxIterations=48){
 const items=source.map(x=>({...x})),groups=new Map();
 for(const x of items){x.groupId=x.groupId??x.id;const g=groups.get(x.groupId)||{area:0,items:[]};g.area+=Math.max(.0001,4*x.hx*x.hz);g.items.push(x);groups.set(x.groupId,g);}
 const translate=(id,dx,dz)=>{for(const x of groups.get(id).items){x.x+=dx;x.z+=dz;}};
 for(let k=0;k<maxIterations;k++){
  let most=0;
  for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
   const a=items[i],b=items[j];if(a.groupId===b.groupId)continue;
   let depth=Infinity,nx=0,nz=0;
   for(const [ax,az] of [...axes(a),...axes(b)]){
    const separation=(b.x-a.x)*ax+(b.z-a.z)*az;
    const d=projectionRadius(a,ax,az)+projectionRadius(b,ax,az)+CLEARANCE-Math.abs(separation);
    if(d<=0){depth=-1;break;}
    if(d<depth){depth=d;const dir=Math.abs(separation)>EPS?Math.sign(separation):String(a.id)<String(b.id)?1:-1;nx=ax*dir;nz=az*dir;}
   }
   if(depth<=0||!Number.isFinite(depth))continue;
   most=Math.max(most,depth);
   const areaA=groups.get(a.groupId).area,areaB=groups.get(b.groupId).area,step=depth+.0005;
   translate(a.groupId,-nx*step*areaB/(areaA+areaB),-nz*step*areaB/(areaA+areaB));
   translate(b.groupId,nx*step*areaA/(areaA+areaB),nz*step*areaA/(areaA+areaB));
  }
  if(most<.0001)break;
 }
 return items.map(({id,x,z})=>({id,x,z}));
}
