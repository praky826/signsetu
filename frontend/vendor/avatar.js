import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/**
 * Initializes the 3D scene, camera, renderer, and lights.
 * Loads the avatar and returns the model + scene objects.
 * @param {HTMLElement} container - The DOM element to append the canvas to.
 * @returns {Promise<{model: THREE.Group, scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer}>}
 */
export function initAvatarScene(container) {
  return new Promise((resolve, reject) => {
    console.log("🔵 Initializing Avatar Scene...");

    // 1. SCENE
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f2f5); // Soft neutral background
    // Add some fog for depth
    scene.fog = new THREE.Fog(0xf0f2f5, 10, 50);

    // 2. CAMERA
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 1.4, 2.5); // Default position facing the avatar

    // 3. RENDERER
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    container.innerHTML = ""; // Clear loading text
    container.appendChild(renderer.domElement);

    // 4. LIGHTS
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(-3, 10, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Backlight for rim effect
    const backLight = new THREE.DirectionalLight(0xffffff, 0.5);
    backLight.position.set(2, 5, -5);
    scene.add(backLight);

    // 5. CONTROLS (Optional, for debugging)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableZoom = false; // Disable zoom to keep frame fixed
    controls.target.set(0, 1.2, 0);
    controls.update();

    // 6. LOAD AVATAR
    const loader = new GLTFLoader();
    loader.load(
      "/models/human.glb", // Ensure this path is correct
      (gltf) => {
        console.log("🟢 Avatar Loaded");
        const model = gltf.scene;

        // Traverse and fix materials/shadows
        model.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;

            // Ensure materials are visible and look good
            if (o.material) {
              o.material.roughness = 0.6;
              o.material.metalness = 0.1;
            }
          }
        });

        // Center and Scale
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        const targetHeight = 1.7; // Standard human height in meters
        const scale = targetHeight / size.y;

        model.scale.setScalar(scale);

        // Re-center after scaling
        box.setFromObject(model);
        box.getCenter(center);
        model.position.x -= center.x;
        model.position.y -= box.min.y; // Feet on ground
        model.position.z -= center.z;

        scene.add(model);

        // Hide loading indicator if it was separate
        const loadingEl = document.getElementById("loading");
        if (loadingEl) loadingEl.style.display = "none";

        // START ANIMATION LOOP
        const animate = () => {
          requestAnimationFrame(animate);
          controls.update();
          renderer.render(scene, camera);
        };
        animate();

        // Handle Resize
        window.addEventListener('resize', () => {
          if (!container) return;
          camera.aspect = container.clientWidth / container.clientHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(container.clientWidth, container.clientHeight);
        });

        resolve({ model, scene, camera, renderer });
      },
      (xhr) => {
        // Progress
        // console.log((xhr.loaded / xhr.total * 100) + '% loaded');
      },
      (error) => {
        console.error("❌ An error occurred loading the avatar:", error);
        reject(error);
      }
    );
  });
}
