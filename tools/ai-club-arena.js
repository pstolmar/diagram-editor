// ── ai-club-arena.js ─────────────────────────────────────────────────────────
// Shared Three.js arena functions for AI Pit Crew pages.
// window.THREE and window.gsap must be loaded before any function is called.

export const SCORING_MAP = {
  'balanced-treads': 250, 'scout-legs': 150, 'heavy-lift': 75,
  'robot-arm': 250, 'grapple-hook': 150, 'suction-cup': 75,
  stabilizer: 250, 'cushion-mount': 150, none: 75,
  'structured-thinker': 250, verifier: 150, 'fast-guesser': 75,
};

export function computeScoreFromConfig(config) {
  return Object.values(config).reduce((sum, id) => sum + (SCORING_MAP[id] || 0), 0);
}

export const MISSION_SCENES = {
  intro: { id: 'intro', title: 'Entering the arena', score: 0, camera: 'third', description: 'Your robot bounds into position.' },
  'high-reach': { id: 'high-reach', title: 'High-reach grab', score: 5, camera: 'cinematic', description: 'The arm extends to the shelf and pulls down the high-value prize.' },
  grapple: { id: 'grapple', title: 'Grapple shot', score: 4, camera: 'close', description: 'The hook fires through the grate and reels in the prize behind it.' },
  scanner: { id: 'scanner', title: 'Target scan', score: 2, camera: 'third', description: 'The scanner dish spins and identifies the highest-value target.' },
  egg: { id: 'egg', title: 'Egg delivery', score: 5, camera: 'close', description: 'The stabilizer lowers the glowing egg onto the pillow cradle and carries it softly to the waiter window.' },
  heavy: { id: 'heavy', title: 'Crate push', score: 2, camera: 'third', description: 'The heavy frame plows into the crate and slides it across the floor.' },
  dash: { id: 'dash', title: 'Speed dash', score: 3, camera: 'driver', description: 'A quick burst across the arena grabs a low-value pickup before the door closes.' },
  balanced: { id: 'balanced', title: 'Route run', score: 2, camera: 'third', description: 'A tidy route across the tiles with a practical mid-value pickup.' },
  verify: { id: 'verify', title: 'Precision check', score: 2, camera: 'close', description: 'Reticle. Pause. Check. A precise pickup that avoids the decoy entirely.' },
  fail: { id: 'fail', title: 'Decoy collision', score: -1, camera: 'third', description: 'The robot rushes in and clips the decoy — points deducted.' },
  finale: { id: 'finale', title: 'Victory pose', score: 1, camera: 'third', description: 'Mission complete. The robot does a victory spin.' },
};

export function buildSceneList(config) {
  const s = MISSION_SCENES;
  const scenes = [s.intro];
  if (config.utility === 'robot-arm') scenes.push(s['high-reach']);
  else if (config.utility === 'grapple-hook') scenes.push(s.grapple);
  else if (config.utility === 'suction-cup') scenes.push(s.egg);
  if (config.brain === 'verifier') scenes.push(s.scanner, s.verify);
  else if (config.brain === 'structured-thinker') scenes.push(s.verify);
  if (config.mobility === 'scout-legs') scenes.push(s.dash);
  else if (config.mobility === 'heavy-lift') scenes.push(s.heavy);
  else scenes.push(s.balanced);
  if (config.care === 'none' && config.mobility === 'scout-legs') scenes.push(s.fail);
  scenes.push(s.finale);
  return scenes;
}

export function buildArenaRobot(scene, config = null, accentHex = null) {
  const { THREE } = window;
  const root = new THREE.Group();
  const bobGroup = new THREE.Group();
  root.add(bobGroup);

  const bodyColor = accentHex ? new THREE.Color(accentHex) : 0x5b7dff;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.45, 2.7),
    new THREE.MeshStandardMaterial({ color: bodyColor, metalness: 0.25, roughness: 0.5, emissive: accentHex ? new THREE.Color(accentHex).multiplyScalar(0.18) : 0x102458, emissiveIntensity: 0.55 }),
  );
  body.castShadow = true;
  body.position.y = 1.15;
  bobGroup.add(body);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(1.05, 0.55, 1.05),
    new THREE.MeshStandardMaterial({ color: 0xd5ecff, emissive: 0x345d9a, emissiveIntensity: 0.25, roughness: 0.35 }),
  );
  head.position.set(0, 2.1, 0.15);
  head.castShadow = true;
  bobGroup.add(head);

  const eyeGeo = new THREE.BoxGeometry(0.18, 0.12, 0.08);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x77f2ed, emissive: 0x77f2ed, emissiveIntensity: 1.2 });
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  const eyeR = eyeL.clone();
  eyeL.position.set(-0.22, 2.12, 0.62);
  eyeR.position.set(0.22, 2.12, 0.62);
  bobGroup.add(eyeL, eyeR);

  const armBase = new THREE.Group();
  armBase.position.set(1.22, 1.55, -0.1);
  armBase.rotation.z = -0.22;
  bobGroup.add(armBase);

  const upperArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 1.4, 0.28),
    new THREE.MeshStandardMaterial({ color: 0xffc56b, roughness: 0.45 }),
  );
  upperArm.position.y = 0.7;
  upperArm.castShadow = true;
  armBase.add(upperArm);

  const forearmPivot = new THREE.Group();
  forearmPivot.position.y = 1.35;
  forearmPivot.rotation.z = 0.18;
  armBase.add(forearmPivot);

  const forearm = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 1.2, 0.22),
    new THREE.MeshStandardMaterial({ color: 0xff925c, roughness: 0.45 }),
  );
  forearm.position.y = 0.6;
  forearm.castShadow = true;
  forearmPivot.add(forearm);

  const claw = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.14, 0.14),
    new THREE.MeshStandardMaterial({ color: 0xf9efe2, roughness: 0.4 }),
  );
  claw.position.y = 1.23;
  forearmPivot.add(claw);

  const hookPivot = new THREE.Group();
  hookPivot.position.set(-1.14, 1.55, -0.2);
  bobGroup.add(hookPivot);

  const cable = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 1.6, 10),
    new THREE.MeshStandardMaterial({ color: 0x87a8bf, metalness: 0.7, roughness: 0.35 }),
  );
  cable.position.y = -0.8;
  hookPivot.add(cable);

  const hook = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.06, 10, 18, Math.PI * 1.35),
    new THREE.MeshStandardMaterial({ color: 0xd3ff70, metalness: 0.65, roughness: 0.25 }),
  );
  hook.rotation.z = Math.PI / 2;
  hook.position.y = -1.58;
  hookPivot.add(hook);

  const scannerPivot = new THREE.Group();
  scannerPivot.position.set(0, 2.35, 1.55);
  bobGroup.add(scannerPivot);
  const scannerDish = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.2, 0.16, 24),
    new THREE.MeshStandardMaterial({ color: 0x77f2ed, emissive: 0x184a4d, emissiveIntensity: 0.55 }),
  );
  scannerDish.rotation.z = Math.PI / 2;
  scannerPivot.add(scannerDish);

  const pillow = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.14, 0.72),
    new THREE.MeshStandardMaterial({ color: 0xb91010, roughness: 0.97, metalness: 0.0 }),
  );
  pillow.position.set(0, 1.97, 0.0);
  bobGroup.add(pillow);

  const legs = [];
  const legMat = new THREE.MeshStandardMaterial({ color: 0x8899aa, metalness: 0.5, roughness: 0.45 });
  const footMat = new THREE.MeshStandardMaterial({ color: 0x77f2ed, roughness: 0.5 });
  [[-1.05, -0.9], [1.05, -0.9], [-1.05, 0.9], [1.05, 0.9]].forEach(([lx, lz], i) => {
    const legGroup = new THREE.Group();
    legGroup.position.set(lx, 0.55, lz);
    legGroup.rotation.z = Math.sign(lx) * 0.32;
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.62, 0.22), legMat);
    thigh.position.y = -0.28;
    legGroup.add(thigh);
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.52, 0.18), legMat);
    shin.position.y = -0.85;
    legGroup.add(shin);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.26), footMat);
    foot.position.set(Math.sign(lx) * 0.1, -1.14, 0.06);
    legGroup.add(foot);
    root.add(legGroup);
    legs.push({ group: legGroup, phase: i * Math.PI * 0.5 });
  });

  const treads = [];
  const treadTracks = [];
  const treadMat = new THREE.MeshStandardMaterial({ color: 0x222e3e, roughness: 0.9 });
  [-1.22, 1.22].forEach((tx) => {
    const track = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.48, 2.5), treadMat);
    track.position.set(tx, 0.28, 0);
    root.add(track);
    treadTracks.push(track);
    const stripGroup = new THREE.Group();
    stripGroup.position.set(tx, 0.55, 0);
    root.add(stripGroup);
    const stripMat = new THREE.MeshStandardMaterial({ color: 0x5cecff, emissive: 0x1a4a5a, emissiveIntensity: 0.5 });
    for (let i = 0; i < 7; i += 1) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.12), stripMat);
      strip.position.z = -0.45 + i * 0.18;
      stripGroup.add(strip);
    }
    treads.push(stripGroup);
  });

  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.34, 20);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x141d2b, roughness: 0.9 });
  [[-1.05, 0.55, 1.02], [1.05, 0.55, 1.02], [-1.05, 0.55, -1.02], [1.05, 0.55, -1.02]].forEach((pos) => {
    const wg = new THREE.Group();
    wg.position.set(...pos);
    wg.rotation.z = Math.PI / 2;
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.castShadow = true;
    wg.add(wheel);
    root.add(wg);
    wheels.push(wg);
  });

  if (config) {
    const usesLegs = config.mobility === 'scout-legs';
    const usesTreads = config.mobility === 'balanced-treads';
    legs.forEach(({ group }) => { group.visible = usesLegs; });
    treadTracks.forEach((t) => { t.visible = usesTreads; });
    treads.forEach((sg) => { sg.visible = usesTreads; });
    wheels.forEach((wg) => { wg.visible = !usesLegs && !usesTreads; });
  }

  scene.add(root);
  return { root, bobGroup, armBase, forearmPivot, hookPivot, cable, hook, scannerPivot, scannerDish, pillow, wheels, legs, treads, eyeL, eyeR };
}

export function buildArenaProps(scene) {
  const { THREE } = window;
  const mantlePrize = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.28, 0),
    new THREE.MeshStandardMaterial({ color: 0xffc76a, emissive: 0x5a3100, emissiveIntensity: 0.55 }),
  );
  mantlePrize.position.set(4.65, 3.35, -3.55);

  const gratePrize = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.25, 0),
    new THREE.MeshStandardMaterial({ color: 0xd3ff70, emissive: 0x334a00, emissiveIntensity: 0.55 }),
  );
  gratePrize.position.set(-5.55, 0.95, 0.55);

  const egg = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 24, 24),
    new THREE.MeshStandardMaterial({ color: 0xd88cff, emissive: 0x5c287d, emissiveIntensity: 0.9, roughness: 0.1, metalness: 0.3 }),
  );
  egg.scale.set(0.82, 1.15, 0.82);
  egg.position.set(1.6, 0.92, 2.45);

  const crate = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 0.85, 0.85),
    new THREE.MeshStandardMaterial({ color: 0x8f6a42, roughness: 0.85 }),
  );
  crate.position.set(-1.6, 0.43, -2.6);

  const decoy = new THREE.Mesh(
    new THREE.ConeGeometry(0.25, 0.6, 4),
    new THREE.MeshStandardMaterial({ color: 0xff566f, emissive: 0x5b1120, emissiveIntensity: 0.5 }),
  );
  decoy.position.set(0.45, 0.38, -0.6);

  [mantlePrize, gratePrize, egg, crate, decoy].forEach((mesh) => {
    mesh.castShadow = true;
    scene.add(mesh);
  });

  return { mantlePrize, gratePrize, egg, crate, decoy };
}

export function applyMissionCamera(kind, cameraState) {
  if (kind === 'close') {
    cameraState.position.set(3.4, 6.5, 8.4);
    cameraState.target.set(1.2, 1.8, 1.8);
    cameraState.fov = 34;
  } else if (kind === 'cinematic') {
    cameraState.position.set(6.2, 7.5, 5.9);
    cameraState.target.set(4.2, 3.5, -3.5);
    cameraState.fov = 32;
  } else if (kind === 'driver') {
    cameraState.position.set(0, 4.5, 2.2);
    cameraState.target.set(0, 2.8, -4.2);
    cameraState.fov = 56;
  } else {
    cameraState.position.set(-5.6, 7.8, 9.5);
    cameraState.target.set(0, 1.5, 0);
    cameraState.fov = 42;
  }
}

export function resetArenaRobot(robot, props) {
  const { gsap } = window;
  gsap.killTweensOf([
    robot.root.position, robot.root.rotation,
    robot.armBase.rotation, robot.forearmPivot.rotation,
    robot.hookPivot.rotation, robot.cable.scale, robot.hook.position,
    robot.scannerPivot.rotation, robot.scannerDish.scale, robot.pillow.position,
    props.mantlePrize.position, props.gratePrize.position,
    props.egg.position, props.crate.position, props.decoy.rotation,
  ]);
  robot.root.position.set(0, 0, 0);
  robot.root.rotation.set(0, 0, 0);
  robot.armBase.rotation.set(0, 0, -0.22);
  robot.forearmPivot.rotation.set(0, 0, 0.18);
  robot.hookPivot.rotation.set(0, 0, 0);
  robot.cable.scale.set(1, 1, 1);
  robot.hook.position.set(0, -1.58, 0);
  robot.scannerPivot.rotation.set(0, 0, 0);
  robot.scannerDish.scale.set(1, 1, 1);
  robot.pillow.position.set(0, 1.82, 0);
  props.mantlePrize.position.set(4.65, 3.35, -3.55);
  props.gratePrize.position.set(-5.55, 0.95, 0.55);
  props.egg.position.set(1.6, 0.92, 2.45);
  props.crate.position.set(-1.6, 0.43, -2.6);
  props.decoy.rotation.set(0, 0, 0);
}

export function playArenaScene(sceneDef, robot, props, cameraState, timeScale = 1) {
  resetArenaRobot(robot, props);
  applyMissionCamera(sceneDef.camera, cameraState);
  const { gsap } = window;
  const tl = gsap.timeline({ timeScale });

  if (sceneDef.id === 'intro') {
    tl.to(robot.root.position, { y: 0.22, duration: 0.35, ease: 'power2.out' })
      .to(robot.root.position, { y: 0, duration: 0.5, ease: 'bounce.out' })
      .to(robot.armBase.rotation, { z: -0.55, duration: 0.35 }, 0.1)
      .to(robot.forearmPivot.rotation, { z: 0.7, duration: 0.35 }, 0.1)
      .to(robot.armBase.rotation, { z: -0.18, duration: 0.42 }, 0.48)
      .to(robot.forearmPivot.rotation, { z: 0.15, duration: 0.42 }, 0.48)
      .to(robot.eyeL.scale, { y: 0.15, duration: 0.08, yoyo: true, repeat: 1 }, 0.24)
      .to(robot.eyeR.scale, { y: 0.15, duration: 0.08, yoyo: true, repeat: 1 }, 0.24);
  } else if (sceneDef.id === 'high-reach') {
    tl.to(robot.root.position, { x: 2.8, z: -2.2, duration: 1.1, ease: 'power2.inOut' })
      .to(robot.armBase.rotation, { z: -1.08, duration: 0.55 }, '-=0.2')
      .to(robot.forearmPivot.rotation, { z: 0.18, duration: 0.55 }, '<')
      .to(props.mantlePrize.position, { x: 3.95, y: 2.25, z: -2.1, duration: 0.55, ease: 'power1.inOut' }, '-=0.08')
      .to(cameraState, { fov: 27, duration: 0.2 }, '-=0.25')
      .to(robot.root.position, { x: 1.5, z: -0.6, duration: 0.8 })
      .to(robot.armBase.rotation, { z: -0.22, duration: 0.45 }, '<')
      .to(robot.forearmPivot.rotation, { z: 0.18, duration: 0.45 }, '<');
  } else if (sceneDef.id === 'grapple') {
    tl.to(robot.root.position, { x: -2.65, z: 0.3, duration: 0.85, ease: 'power2.inOut' })
      .to(robot.hookPivot.rotation, { z: 0.25, duration: 0.25 })
      .to(robot.cable.scale, { y: 1.9, duration: 0.4 }, '<')
      .to(robot.hook.position, { y: -2.55, x: -1.1, duration: 0.4 }, '<')
      .to(props.gratePrize.position, { x: -2.75, y: 1.05, z: 0.3, duration: 0.28, ease: 'steps(4)' })
      .to(cameraState, { fov: 24, duration: 0.18 }, '<')
      .to(robot.cable.scale, { y: 1, duration: 0.35 }, '<')
      .to(robot.hook.position, { y: -1.58, x: 0, duration: 0.35 }, '<');
  } else if (sceneDef.id === 'scanner') {
    tl.to(robot.scannerPivot.rotation, { y: Math.PI * 2, duration: 1.15, ease: 'none' })
      .to(robot.scannerDish.scale, { x: 1.4, z: 1.4, duration: 0.25, yoyo: true, repeat: 3 }, 0.15)
      .to(props.decoy.rotation, { y: Math.PI * 0.5, duration: 0.5 }, 0.25)
      .to(props.mantlePrize.position, { y: props.mantlePrize.position.y + 0.12, duration: 0.3, yoyo: true, repeat: 2 }, 0.45);
  } else if (sceneDef.id === 'egg') {
    tl.to(robot.root.position, { x: 1.5, z: 2.1, duration: 1.0, ease: 'power1.inOut' })
      .to(props.egg.position, { x: 1.5, y: 2.22, z: 2.1, duration: 0.7, ease: 'power1.inOut' })
      .to(cameraState, { fov: 26, duration: 0.25 }, '-=0.45')
      .to(robot.root.position, { x: 0.1, z: 4.2, duration: 1.6, ease: 'power1.inOut' })
      .to(props.egg.position, { x: 0.1, y: 2.22, z: 4.3, duration: 1.6, ease: 'power1.inOut' }, '<')
      .to(props.egg.position, { x: 0.0, y: 1.82, z: 5.35, duration: 0.6, ease: 'power1.out' });
  } else if (sceneDef.id === 'heavy') {
    tl.to(robot.root.position, { x: -1.2, z: -1.8, duration: 0.75 })
      .to(props.crate.position, { x: -0.2, y: 0.62, z: -1.3, duration: 0.55 }, '-=0.1')
      .to(robot.root.position, { x: 2.4, z: -0.8, duration: 0.85 })
      .to(props.crate.position, { x: 3.3, y: 0.48, z: -0.3, duration: 0.4 });
  } else if (sceneDef.id === 'dash') {
    tl.to(robot.root.position, { x: -3.4, z: 2.6, duration: 0.4, ease: 'power3.out' })
      .to(robot.root.position, { x: 2.8, z: 1.1, duration: 0.45, ease: 'power3.in' })
      .to(robot.root.rotation, { y: 0.25, duration: 0.18, yoyo: true, repeat: 1 }, 0.18);
  } else if (sceneDef.id === 'verify') {
    tl.to(robot.root.position, { x: 0.9, z: -0.15, duration: 0.5 })
      .to(robot.scannerDish.scale, { x: 1.65, z: 1.65, duration: 0.35, yoyo: true, repeat: 1 })
      .to(robot.armBase.rotation, { z: -0.72, duration: 0.3 })
      .to(robot.forearmPivot.rotation, { z: 0.12, duration: 0.3 }, '<')
      .to(props.decoy.rotation, { x: 0.65, duration: 0.3 }, '-=0.08');
  } else if (sceneDef.id === 'balanced') {
    tl.to(robot.root.position, { x: 1.3, z: -1.3, duration: 0.55 })
      .to(robot.root.position, { x: 2.4, z: 0.65, duration: 0.7 })
      .to(robot.root.position, { x: 0.4, z: 1.4, duration: 0.45 });
  } else if (sceneDef.id === 'fail') {
    tl.to(robot.root.position, { x: 0.65, z: -0.22, duration: 0.35 })
      .to(props.decoy.rotation, { z: 1.2, duration: 0.2 }, '-=0.05')
      .to(cameraState, { fov: 28, duration: 0.15 }, '<')
      .to(robot.root.rotation, { z: 0.18, duration: 0.15, yoyo: true, repeat: 3 }, '-=0.08')
      .to(robot.root.position, { x: -0.55, z: 0.45, duration: 0.5 });
  } else if (sceneDef.id === 'finale') {
    tl.to(robot.root.position, { y: 0.18, duration: 0.28, yoyo: true, repeat: 1 })
      .to(robot.root.rotation, { y: Math.PI * 2, duration: 1.2, ease: 'power1.inOut' }, 0)
      .to(robot.scannerDish.scale, { x: 1.35, z: 1.35, duration: 0.22, yoyo: true, repeat: 3 }, 0.15);
  }

  return new Promise((resolve) => { tl.eventCallback('onComplete', resolve); });
}

export function buildPodiumRobot(config, scene, accentHex) {
  const { THREE } = window;
  const root = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(accentHex), roughness: 0.45, metalness: 0.55,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.5, metalness: 0.6 });
  const greyMat = new THREE.MeshStandardMaterial({ color: 0x444455, roughness: 0.7, metalness: 0.5 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.1, 0.9), bodyMat);
  body.position.y = 1.15;
  body.castShadow = true;
  root.add(body);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.52, 0.62), darkMat);
  head.position.y = 1.93;
  head.castShadow = true;
  root.add(head);

  const treads = [];
  const legs = [];

  if (config.mobility === 'scout-legs') {
    const legMat = new THREE.MeshStandardMaterial({ color: 0x888899, roughness: 0.6, metalness: 0.5 });
    [[-0.55, 0.38], [0.55, 0.38], [-0.55, -0.38], [0.55, -0.38]].forEach(([x, z], i) => {
      const legGroup = new THREE.Group();
      legGroup.position.set(x, 0.68, z);
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.52, 8), legMat);
      upper.position.set(Math.sign(x) * 0.14, -0.18, 0);
      upper.rotation.z = Math.sign(x) * 0.45;
      upper.castShadow = true;
      legGroup.add(upper);
      const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.032, 0.44, 8), legMat);
      lower.position.set(Math.sign(x) * 0.26, -0.48, 0);
      lower.rotation.z = Math.sign(x) * -0.3;
      lower.castShadow = true;
      legGroup.add(lower);
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), greyMat);
      foot.position.set(Math.sign(x) * 0.33, -0.68, 0);
      foot.castShadow = true;
      legGroup.add(foot);
      root.add(legGroup);
      legs.push({ group: legGroup, phase: (i % 2) * Math.PI });
    });
  } else if (config.mobility === 'balanced-treads') {
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.95 });
    const padMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9 });
    [-0.68, 0.68].forEach((x) => {
      const track = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 1.0), trackMat);
      track.position.set(x, 0.14, 0);
      track.castShadow = true;
      root.add(track);
      const stripGroup = new THREE.Group();
      stripGroup.position.set(x, 0.14, 0);
      for (let i = 0; i < 6; i += 1) {
        const pad = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.12), padMat);
        pad.position.z = -0.45 + i * 0.18;
        pad.position.y = 0.12;
        stripGroup.add(pad);
      }
      root.add(stripGroup);
      treads.push(stripGroup);
    });
  } else {
    const wGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 14);
    const wMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    const hubMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5, metalness: 0.8 });
    [[-0.65, 0.28, 0.48], [0.65, 0.28, 0.48], [-0.65, 0.28, -0.48], [0.65, 0.28, -0.48]].forEach((pos) => {
      const wg = new THREE.Group();
      wg.position.set(...pos);
      wg.rotation.z = Math.PI / 2;
      const w = new THREE.Mesh(wGeo, wMat);
      w.castShadow = true;
      wg.add(w);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.24, 8), hubMat);
      wg.add(hub);
      root.add(wg);
    });
  }

  let armBase = null;
  if (config.utility === 'robot-arm') {
    armBase = new THREE.Group();
    armBase.position.set(0.52, 1.55, 0);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.16), bodyMat);
    upper.position.y = 0.31;
    upper.castShadow = true;
    armBase.add(upper);
    const claw = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.12, 0.12), darkMat);
    claw.position.set(0, 0.68, 0);
    armBase.add(claw);
    root.add(armBase);
  } else if (config.utility === 'suction-cup') {
    const suckBase = new THREE.Group();
    suckBase.position.set(0.52, 1.4, 0);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.5, 10), greyMat);
    tube.rotation.z = Math.PI / 2;
    tube.position.x = 0.25;
    tube.castShadow = true;
    suckBase.add(tube);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.06, 16), bodyMat);
    disc.rotation.z = Math.PI / 2;
    disc.position.x = 0.54;
    disc.castShadow = true;
    suckBase.add(disc);
    root.add(suckBase);
  } else if (config.utility === 'grapple-hook') {
    const hookBase = new THREE.Group();
    hookBase.position.set(0.0, 2.05, 0);
    const spool = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.22, 12), greyMat);
    spool.rotation.z = Math.PI / 2;
    spool.position.x = 0.5;
    hookBase.add(spool);
    const cableM = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.44, 6), darkMat);
    cableM.rotation.z = Math.PI / 2;
    cableM.position.x = 0.76;
    hookBase.add(cableM);
    const hookTip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 8), bodyMat);
    hookTip.position.x = 1.0;
    hookTip.rotation.z = -Math.PI / 2;
    hookTip.castShadow = true;
    hookBase.add(hookTip);
    root.add(hookBase);
  }

  if (config.care === 'stabilizer') {
    const stabMat = new THREE.MeshStandardMaterial({ color: 0x667788, roughness: 0.4, metalness: 0.7 });
    [-1, 1].forEach((side) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.07, 0.07), stabMat);
      arm.position.set(side * 0.9, 0.75, 0);
      arm.castShadow = true;
      root.add(arm);
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.06, 10), darkMat);
      tip.position.set(side * 1.1, 0.75, 0);
      tip.rotation.x = Math.PI / 2;
      tip.castShadow = true;
      root.add(tip);
    });
  } else if (config.care === 'cushion-mount') {
    const cushMat = new THREE.MeshStandardMaterial({ color: 0x8899aa, roughness: 0.95 });
    const cush = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.95), cushMat);
    cush.position.set(0, 0.65, 0);
    cush.castShadow = true;
    root.add(cush);
  }

  const glowColor = config.brain === 'fast-guesser' ? 0xffff00
    : config.brain === 'verifier' ? 0x22c55e : 0x38bdf8;
  const antMat = new THREE.MeshStandardMaterial({
    color: glowColor, emissive: glowColor, emissiveIntensity: 0.7,
  });
  if (config.brain === 'fast-guesser') {
    [-0.14, 0, 0.14].forEach((x) => {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.3, 6), antMat);
      ant.position.set(x, 2.27, 0);
      root.add(ant);
    });
  } else if (config.brain === 'verifier') {
    [-0.12, 0.12].forEach((x) => {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.38, 6), antMat);
      ant.position.set(x, 2.30, 0);
      root.add(ant);
    });
  } else {
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.52, 6), antMat);
    ant.position.set(0, 2.45, 0);
    root.add(ant);
  }

  scene.add(root);
  return { root, armBase, treads, legs };
}

// ── Scene setup helpers ───────────────────────────────────────────────────────

export function setupArena(canvas, config, accent = null) {
  const { THREE } = window;
  const W = canvas.clientWidth || canvas.width || 600;
  const H = Math.round(W * 0.56);
  canvas.width = W;
  canvas.height = H;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 60);
  camera.position.set(-5.6, 7.8, 9.5);

  scene.add(new THREE.AmbientLight(0x334466, 0.85));
  const keyLight = new THREE.DirectionalLight(0xfff5e8, 1.3);
  keyLight.position.set(6, 10, 8);
  keyLight.castShadow = true;
  scene.add(keyLight);
  const rim = new THREE.PointLight(0xff925c, 1.1, 30);
  rim.position.set(-8, 6, -8);
  scene.add(rim);

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(18, 0.8, 14),
    new THREE.MeshStandardMaterial({ color: 0x10203b, metalness: 0.15, roughness: 0.9 }),
  );
  floor.receiveShadow = true;
  floor.position.y = -0.4;
  scene.add(floor);
  const grid = new THREE.GridHelper(18, 18, 0x5cecff, 0x173250);
  grid.position.y = 0.02;
  scene.add(grid);

  const mantle = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 0.45, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x73553d, roughness: 0.85 }),
  );
  mantle.position.set(4.6, 2.8, -3.6);
  mantle.castShadow = true;
  scene.add(mantle);

  const grate = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 2.8, 5),
    new THREE.MeshStandardMaterial({ color: 0x40566d, metalness: 0.65, roughness: 0.4 }),
  );
  grate.position.set(-4.5, 1.5, 0);
  scene.add(grate);
  for (let i = -2; i <= 2; i += 1) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 2.3, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x7d95ab, metalness: 0.75, roughness: 0.3 }),
    );
    bar.position.set(-4.3, 1.5, i);
    scene.add(bar);
  }

  const waiterWindow = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 1.3, 0.2),
    new THREE.MeshStandardMaterial({ color: 0xeed9aa, emissive: 0x674318, emissiveIntensity: 0.4 }),
  );
  waiterWindow.position.set(0, 1.8, 5.4);
  scene.add(waiterWindow);

  const atmoPos = new Float32Array(120 * 3);
  for (let i = 0; i < 120; i += 1) {
    atmoPos[i * 3] = (Math.random() - 0.5) * 30;
    atmoPos[i * 3 + 1] = Math.random() * 4 + 5.5;
    atmoPos[i * 3 + 2] = -8 - Math.random() * 14;
  }
  const atmoGeo = new THREE.BufferGeometry();
  atmoGeo.setAttribute('position', new THREE.BufferAttribute(atmoPos, 3));
  const atmosphere = new THREE.Points(atmoGeo, new THREE.PointsMaterial({
    color: 0x77f2ed, size: 0.08, transparent: true, opacity: 0.28, depthWrite: false,
  }));
  scene.add(atmosphere);

  const robot = buildArenaRobot(scene, config, accent);
  const props = buildArenaProps(scene);

  const target = new THREE.Vector3(0, 1.5, 0);
  const cameraState = { position: camera.position.clone(), target: target.clone(), fov: 42 };
  applyMissionCamera('third', cameraState);

  return {
    renderer, scene, camera, target, cameraState, robot, props, atmosphere,
  };
}

export function startArenaLoop({
  renderer, scene, camera, target, cameraState, robot, atmosphere,
}) {
  const { THREE } = window;
  const clock = new THREE.Clock();
  let animId;
  function loop() {
    animId = requestAnimationFrame(loop);
    const t = clock.getElapsedTime();
    robot.wheels.forEach((wheel, i) => { wheel.children[0].rotation.y += 0.042 + (i % 2) * 0.004; });
    robot.bobGroup.position.y = Math.sin(t * 2.6) * 0.06;
    robot.legs.forEach(({ group, phase }) => {
      const swing = Math.sin(t * 6 + phase) * 0.28;
      group.rotation.x = swing;
      group.children[0].position.y = -0.28 + Math.abs(swing) * 0.1;
    });
    robot.treads.forEach((sg) => {
      sg.children.forEach((pad, i) => {
        pad.position.z = -0.45 + ((i * 0.18 + t * 0.4) % 1.26) - 0.63;
      });
    });
    atmosphere.rotation.y += 0.0008;
    camera.position.lerp(cameraState.position, 0.08);
    target.lerp(cameraState.target, 0.08);
    camera.fov += (cameraState.fov - camera.fov) * 0.08;
    camera.updateProjectionMatrix();
    camera.lookAt(target);
    renderer.render(scene, camera);
  }
  loop();
  return () => { cancelAnimationFrame(animId); };
}

// ── Confetti ─────────────────────────────────────────────────────────────────
// xRange: [minVw, maxVw] — defaults to full viewport width.
// Pass [0, 50] for left-side winner, [50, 100] for right-side winner.

export function spawnConfetti(xRange = [0, 100]) {
  const colors = ['#ffd700', '#38bdf8', '#22c55e', '#f59e0b', '#c084fc', '#f472b6'];
  const [xMin, xMax] = xRange;
  Array.from({ length: 60 }).forEach(() => {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.cssText = [
      `left:${xMin + Math.random() * (xMax - xMin)}vw`,
      `background:${colors[Math.floor(Math.random() * colors.length)]}`,
      `animation-delay:${Math.random() * 1.5}s`,
      `animation-duration:${1.5 + Math.random() * 2}s`,
      `width:${6 + Math.random() * 8}px`,
      `height:${6 + Math.random() * 8}px`,
      `transform:rotate(${Math.random() * 360}deg)`,
    ].join(';');
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  });
}
