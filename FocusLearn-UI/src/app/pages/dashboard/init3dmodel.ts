import * as THREE from 'three';

export function init3DModel(container: HTMLElement) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ alpha: true });
  renderer.setSize(300, 300);
  container.appendChild(renderer.domElement);

  // Create a simple 3D book model
  const bookGeometry = new THREE.BoxGeometry(2, 2.5, 0.3);
  const bookMaterial = new THREE.MeshPhongMaterial({ color: 0x8e2de2, shininess: 100 });
  const book = new THREE.Mesh(bookGeometry, bookMaterial);
  scene.add(book);

  // Add lighting
  const light = new THREE.PointLight(0xffffff, 1, 100);
  light.position.set(5, 5, 5);
  scene.add(light);

  camera.position.z = 5;

  function animate() {
    requestAnimationFrame(animate);
    book.rotation.y += 0.02;
    book.rotation.x += 0.01;
    renderer.render(scene, camera);
  }
  animate();
}