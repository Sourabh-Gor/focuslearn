import * as THREE from 'three';

export function initGlobe(container: HTMLElement) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ alpha: true });
  renderer.setSize(200, 200);
  container.appendChild(renderer.domElement);

  const geometry = new THREE.SphereGeometry(1, 32, 32);
  const material = new THREE.MeshBasicMaterial({ color: 0x6e8efb, wireframe: true });
  const globe = new THREE.Mesh(geometry, material);
  scene.add(globe);

  camera.position.z = 2;

  function animate() {
    requestAnimationFrame(animate);
    globe.rotation.y += 0.01;
    renderer.render(scene, camera);
  }
  animate();
}