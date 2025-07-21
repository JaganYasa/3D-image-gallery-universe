// ...removed extraneous <script> tag...
        class Galaxy3D {
            constructor() {
                this.scene = new THREE.Scene();
                this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
                this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
                this.mediaItems = [];
                this.currentView = 'sphere';
                this.mouse = new THREE.Vector2();
                this.raycaster = new THREE.Raycaster();
                this.controls = {
                    mouseX: 0,
                    mouseY: 0,
                    isMouseDown: false
                };
                this.particleSystem = null;
                this.geometries = new Map();
                this.materials = new Map();
                this.loadingProgress = 0;
                
                this.init();
                this.createEnvironment();
                this.setupEventListeners();
                this.loadSampleData();
                this.animate();
                this.hideLoadingScreen();
            }
            
            init() {
                this.renderer.setSize(window.innerWidth, window.innerHeight);
                this.renderer.setPixelRatio(window.devicePixelRatio);
                this.renderer.setClearColor(0x000000, 0);
                this.renderer.shadowMap.enabled = true;
                this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
                
                document.getElementById('three-container').appendChild(this.renderer.domElement);
                
                this.camera.position.set(0, 0, 1000);
                
                // Create reusable geometries and materials
                this.geometries.set('sphere', new THREE.SphereGeometry(1, 32, 32));
                this.geometries.set('box', new THREE.BoxGeometry(1, 1, 1));
                this.geometries.set('plane', new THREE.PlaneGeometry(200, 250, 32, 32));
                
                // Holographic materials
                this.materials.set('hologram', new THREE.ShaderMaterial({
                    uniforms: {
                        time: { value: 0 },
                        texture: { value: null }
                    },
                    vertexShader: `
                        varying vec2 vUv;
                        varying vec3 vPosition;
                        uniform float time;
                        
                        void main() {
                            vUv = uv;
                            vPosition = position;
                            
                            vec3 pos = position;
                            pos.z += sin(pos.x * 0.1 + time) * 5.0;
                            pos.z += cos(pos.y * 0.1 + time) * 5.0;
                            
                            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                        }
                    `,
                    fragmentShader: `
                        uniform float time;
                        uniform sampler2D texture;
                        varying vec2 vUv;
                        varying vec3 vPosition;
                        
                        void main() {
                            vec4 texColor = texture2D(texture, vUv);
                            
                            float hologram = sin(vPosition.y * 0.5 + time * 3.0) * 0.1 + 0.9;
                            float scanline = sin(vUv.y * 100.0 + time * 10.0) * 0.05 + 0.95;
                            
                            vec3 color = texColor.rgb;
                            color += vec3(0.0, 0.5, 1.0) * hologram * 0.3;
                            color *= scanline;
                            
                            gl_FragColor = vec4(color, texColor.a * 0.9);
                        }
                    `,
                    transparent: true,
                    side: THREE.DoubleSide
                }));
            }
            
            createEnvironment() {
                // Starfield background
                const starsGeometry = new THREE.BufferGeometry();
                const starsMaterial = new THREE.PointsMaterial({
                    color: 0x00f5ff,
                    size: 2,
                    transparent: true,
                    opacity: 0.8
                });
                
                const starsVertices = [];
                for (let i = 0; i < 10000; i++) {
                    starsVertices.push(
                        (Math.random() - 0.5) * 10000,
                        (Math.random() - 0.5) * 10000,
                        (Math.random() - 0.5) * 10000
                    );
                }
                
                starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
                this.starField = new THREE.Points(starsGeometry, starsMaterial);
                this.scene.add(this.starField);
                
                // Nebula effect
                this.createNebulaEffect();
                
                // Ambient lighting
                const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
                this.scene.add(ambientLight);
                
                // Directional light
                const directionalLight = new THREE.DirectionalLight(0x00f5ff, 1);
                directionalLight.position.set(100, 100, 50);
                directionalLight.castShadow = true;
                this.scene.add(directionalLight);
                
                // Point lights for atmosphere
                const pointLight1 = new THREE.PointLight(0xff00ff, 0.5, 1000);
                pointLight1.position.set(-500, 0, 0);
                this.scene.add(pointLight1);
                
                const pointLight2 = new THREE.PointLight(0x00ff00, 0.5, 1000);
                pointLight2.position.set(500, 0, 0);
                this.scene.add(pointLight2);
            }
            
            createNebulaEffect() {
                const nebulaGeometry = new THREE.PlaneGeometry(5000, 5000, 100, 100);
                const nebulaMaterial = new THREE.ShaderMaterial({
                    uniforms: {
                        time: { value: 0 }
                    },
                    vertexShader: `
                        varying vec2 vUv;
                        void main() {
                            vUv = uv;
                            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                        }
                    `,
                    fragmentShader: `
                        uniform float time;
                        varying vec2 vUv;
                        
                        float noise(vec2 p) {
                            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
                        }
                        
                        void main() {
                            vec2 uv = vUv * 2.0;
                            float n1 = noise(uv + time * 0.1);
                            float n2 = noise(uv * 2.0 + time * 0.15);
                            float n3 = noise(uv * 4.0 + time * 0.2);
                            
                            float nebula = (n1 + n2 * 0.5 + n3 * 0.25) / 1.75;
                            
                            vec3 color1 = vec3(0.0, 0.3, 1.0);
                            vec3 color2 = vec3(1.0, 0.0, 0.5);
                            vec3 color3 = vec3(0.0, 1.0, 0.5);
                            
                            vec3 finalColor = mix(color1, color2, nebula);
                            finalColor = mix(finalColor, color3, sin(time + nebula) * 0.5 + 0.5);
                            
                            gl_FragColor = vec4(finalColor, nebula * 0.1);
                        }
                    `,
                    transparent: true,
                    side: THREE.DoubleSide
                });
                
                this.nebula = new THREE.Mesh(nebulaGeometry, nebulaMaterial);
                this.nebula.position.z = -2000;
                this.scene.add(this.nebula);
            }
            
            setupEventListeners() {
                // Mouse controls
                window.addEventListener('mousemove', (event) => {
                    this.controls.mouseX = (event.clientX / window.innerWidth) * 2 - 1;
                    this.controls.mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
                    
                    this.mouse.x = this.controls.mouseX;
                    this.mouse.y = this.controls.mouseY;
                    
                    // Update coordinates display
                    this.updateHUD();
                });
                
                window.addEventListener('mousedown', () => {
                    this.controls.isMouseDown = true;
                });
                
                window.addEventListener('mouseup', () => {
                    this.controls.isMouseDown = false;
                });
                
                // Click detection for media items
                window.addEventListener('click', (event) => {
                    this.raycaster.setFromCamera(this.mouse, this.camera);
                    const intersects = this.raycaster.intersectObjects(this.mediaItems.map(item => item.mesh));
                    
                    if (intersects.length > 0) {
                        const item = this.mediaItems.find(item => item.mesh === intersects[0].object);
                        if (item) {
                            this.showInfo(item.data);
                        }
                    }
                });
                
                // View controls
                document.querySelectorAll('.control-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        document.querySelectorAll('.control-btn').forEach(b => b.classList.remove('active'));
                        e.target.classList.add('active');
                        this.changeView(e.target.dataset.view);
                    });
                });
                
                // Upload functionality
                document.querySelector('.upload-btn').addEventListener('click', () => {
                    document.getElementById('fileInput').click();
                });
                
                document.getElementById('fileInput').addEventListener('change', (e) => {
                    this.handleFileUpload(e.target.files);
                });
                
                // Info panel close
                document.getElementById('closeBtn').addEventListener('click', () => {
                    document.getElementById('infoPanel').classList.remove('active');
                });
                
                // Window resize
                window.addEventListener('resize', () => {
                    this.camera.aspect = window.innerWidth / window.innerHeight;
                    this.camera.updateProjectionMatrix();
                    this.renderer.setSize(window.innerWidth, window.innerHeight);
                });
                
                // Keyboard controls
                window.addEventListener('keydown', (event) => {
                    switch(event.code) {
                        case 'KeyW':
                            this.camera.position.z -= 50;
                            break;
                        case 'KeyS':
                            this.camera.position.z += 50;
                            break;
                        case 'KeyA':
                            this.camera.position.x -= 50;
                            break;
                        case 'KeyD':
                            this.camera.position.x += 50;
                            break;
                        case 'Space':
                            this.camera.position.set(0, 0, 1000);
                            break;
                    }
                    this.updateHUD();
                });
            }
            
            loadSampleData() {
                const sampleData = [
                    {
                        type: 'image',
                        src: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=600&fit=crop',
                        title: 'Mountain Adventure',
                        description: 'A breathtaking sunrise captured during our hiking trip to the Rocky Mountains. The golden light painted the peaks in warm hues, creating a moment of pure tranquility.',
                        date: '2024-08-15',
                        location: 'Rocky Mountains, Colorado',
                        emotion: 'Wonder',
                        clarity: 95
                    },
                    {
                        type: 'image',
                        src: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=600&fit=crop',
                        title: 'Ocean Serenity',
                        description: 'Peaceful morning at the beach, watching the waves gently kiss the shore. The perfect moment of tranquility and connection with nature.',
                        date: '2024-07-22',
                        location: 'Malibu Beach, California',
                        emotion: 'Peace',
                        clarity: 88
                    },
                    {
                        type: 'image',
                        src: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=600&fit=crop',
                        title: 'Forest Walk',
                        description: 'Autumn leaves creating a natural carpet through the enchanted forest path. Nature\'s artwork displaying the beauty of seasonal change.',
                        date: '2024-10-03',
                        location: 'Vermont Forest Trail',
                        emotion: 'Nostalgia',
                        clarity: 92
                    },
                    {
                        type: 'image',
                        src: 'https://images.unsplash.com/photo-1514905552197-0610a4d8fd73?w=400&h=600&fit=crop',
                        title: 'City Lights',
                        description: 'The urban jungle comes alive at night, with countless stories unfolding in each glowing window. A testament to human creativity and ambition.',
                        date: '2024-09-18',
                        location: 'New York City',
                        emotion: 'Excitement',
                        clarity: 78
                    },
                    {
                        type: 'image',
                        src: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400&h=600&fit=crop',
                        title: 'Desert Dreams',
                        description: 'Endless dunes stretching to the horizon, where silence speaks louder than words. A place of meditation and infinite possibilities.',
                        date: '2024-06-12',
                        location: 'Sahara Desert, Morocco',
                        emotion: 'Solitude',
                        clarity: 100
                    },
                    {
                        type: 'image',
                        src: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=400&h=600&fit=crop',
                        title: 'Cosmic Wonder',
                        description: 'Gazing up at the infinite cosmos, where stars tell stories of ancient light and distant worlds.',
                        date: '2024-11-08',
                        location: 'Observatory Peak',
                        emotion: 'Awe',
                        clarity: 96
                    }
                ];
                
                sampleData.forEach((item, index) => {
                    this.createMediaItem(item, index);
                });
                
                this.arrangeItems();
            }
            
            createMediaItem(data, index) {
                // Create holographic frame
                const frameGeometry = new THREE.RingGeometry(95, 105, 32);
                const frameMaterial = new THREE.MeshBasicMaterial({
                    color: 0x00f5ff,
                    transparent: true,
                    opacity: 0.6
                });
                const frame = new THREE.Mesh(frameGeometry, frameMaterial);
                
                // Create media plane
                const planeGeometry = this.geometries.get('plane').clone();
                
                // Load texture
                const textureLoader = new THREE.TextureLoader();
                textureLoader.load(data.src, (texture) => {
                    const hologramMaterial = this.materials.get('hologram').clone();
                    hologramMaterial.uniforms.texture.value = texture;
                    
                    const plane = new THREE.Mesh(planeGeometry, hologramMaterial);
                    
                    // Create glow effect
                    const glowGeometry = new THREE.PlaneGeometry(220, 270);
                    const glowMaterial = new THREE.ShaderMaterial({
                        uniforms: {
                            time: { value: 0 },
                            color: { value: new THREE.Color(0x00f5ff) }
                        },
                        vertexShader: `
                            varying vec2 vUv;
                            void main() {
                                vUv = uv;
                                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                            }
                        `,
                        fragmentShader: `
                            uniform float time;
                            uniform vec3 color;
                            varying vec2 vUv;
                            
                            void main() {
                                vec2 center = vec2(0.5);
                                float dist = distance(vUv, center);
                                float glow = 1.0 - smoothstep(0.0, 0.5, dist);
                                glow *= (sin(time * 2.0) * 0.3 + 0.7);
                                
                                gl_FragColor = vec4(color, glow * 0.3);
                            }
                        `,
                        transparent: true,
                        blending: THREE.AdditiveBlending
                    });
                    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
                    glowMesh.position.z = -5;
                    
                    // Create particle system for each item
                    this.createItemParticles(plane, data);
                    
                    // Create group
                    const group = new THREE.Group();
                    group.add(frame);
                    group.add(plane);
                    group.add(glowMesh);
                    
                    // Add floating animation
                    group.userData = {
                        originalY: 0,
                        floatOffset: Math.random() * Math.PI * 2,
                        rotationSpeed: (Math.random() - 0.5) * 0.01
                    };
                    
                    this.scene.add(group);
                    this.mediaItems.push({
                        mesh: plane,
                        group: group,
                        frame: frame,
                        glow: glowMesh,
                        data: data,
                        index: index
                    });
                    
                    this.updateLoadingProgress();
                });
            }
            
            createItemParticles(parentMesh, data) {
                const particleCount = 100;
                const particlesGeometry = new THREE.BufferGeometry();
                const particlesMaterial = new THREE.PointsMaterial({
                    color: 0x00f5ff,
                    size: 2,
                    transparent: true,
                    opacity: 0.6,
                    blending: THREE.AdditiveBlending
                });
                
                const positions = [];
                for (let i = 0; i < particleCount; i++) {
                    positions.push(
                        (Math.random() - 0.5) * 400,
                        (Math.random() - 0.5) * 500,
                        (Math.random() - 0.5) * 100
                    );
                }
                
                particlesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
                const particles = new THREE.Points(particlesGeometry, particlesMaterial);
                parentMesh.parent.add(particles);
                
                // Store particle system for animation
                parentMesh.userData.particles = particles;
            }
            
            arrangeItems() {
                switch(this.currentView) {
                    case 'sphere':
                        this.arrangeSphere();
                        break;
                    case 'spiral':
                        this.arrangeSpiral();
                        break;
                    case 'cube':
                        this.arrangeCube();
                        break;
                    case 'portal':
                        this.arrangePortal();
                        break;
                }
            }
            
            arrangeSphere() {
                const radius = 800;
                this.mediaItems.forEach((item, index) => {
                    const phi = Math.acos(-1 + (2 * index) / this.mediaItems.length);
                    const theta = Math.sqrt(this.mediaItems.length * Math.PI) * phi;
                    
                    const x = radius * Math.cos(theta) * Math.sin(phi);
                    const y = radius * Math.sin(theta) * Math.sin(phi);
                    const z = radius * Math.cos(phi);
                    
                    item.group.userData.targetPosition = new THREE.Vector3(x, y, z);
                    item.group.userData.targetRotation = new THREE.Euler(phi, theta, 0);
                });
            }
            
            arrangeSpiral() {
                const radius = 600;
                const height = 200;
                this.mediaItems.forEach((item, index) => {
                    const angle = (index / this.mediaItems.length) * Math.PI * 8;
                    const spiralRadius = radius * (1 - index / this.mediaItems.length);
                    
                    const x = Math.cos(angle) * spiralRadius;
                    const z = Math.sin(angle) * spiralRadius;
                    const y = (index - this.mediaItems.length / 2) * height;
                    
                    item.group.userData.targetPosition = new THREE.Vector3(x, y, z);
                    item.group.userData.targetRotation = new THREE.Euler(0, -angle, 0);
                });
            }
            
            arrangeCube() {
                const size = 600;
                const itemsPerSide = Math.ceil(Math.pow(this.mediaItems.length, 1/3));
                
                this.mediaItems.forEach((item, index) => {
                    const x = (index % itemsPerSide - itemsPerSide / 2) * (size / itemsPerSide);
                    const y = (Math.floor(index / itemsPerSide) % itemsPerSide - itemsPerSide / 2) * (size / itemsPerSide);
                    const z = (Math.floor(index / (itemsPerSide * itemsPerSide)) - itemsPerSide / 2) * (size / itemsPerSide);
                    
                    item.group.userData.targetPosition = new THREE.Vector3(x, y, z);
                    item.group.userData.targetRotation = new THREE.Euler(0, 0, 0);
                });
            }
            
            arrangePortal() {
                const radius = 400;
                this.mediaItems.forEach((item, index) => {
                    const angle = (index / this.mediaItems.length) * Math.PI * 2;
                    const x = Math.cos(angle) * radius;
                    const z = Math.sin(angle) * radius;
                    const y = 0;
                    
                    item.group.userData.targetPosition = new THREE.Vector3(x, y, z);
                    item.group.userData.targetRotation = new THREE.Euler(0, -angle + Math.PI/2, 0);
                });
            }
            
            changeView(view) {
                this.currentView = view;
                this.arrangeItems();
            }
            
            updateLoadingProgress() {
                this.loadingProgress += (100 / 6); // 6 sample items
                document.getElementById('progressBar').style.width = `${Math.min(this.loadingProgress, 100)}%`;
            }
            
            hideLoadingScreen() {
                setTimeout(() => {
                    document.getElementById('loadingScreen').classList.add('hidden');
                }, 2000);
            }
            
            showInfo(data) {
                document.getElementById('infoTitle').textContent = data.title;
                document.getElementById('infoDescription').textContent = data.description;
                document.getElementById('infoDate').textContent = `📅 ${new Date(data.date).toLocaleDateString()}`;
                document.getElementById('infoLocation').textContent = `📍 ${data.location}`;
                document.getElementById('emotionLevel').textContent = data.emotion;
                document.getElementById('clarityFill').style.width = `${data.clarity}%`;
                
                document.getElementById('infoPanel').classList.add('active');
            }
            
            updateHUD() {
                // Update compass
                const compassArrow = document.querySelector('.compass-arrow');
                const angle = Math.atan2(this.controls.mouseY, this.controls.mouseX) * (180 / Math.PI);
                compassArrow.style.transform = `translate(-50%, -100%) rotate(${angle}deg)`;
                
                // Update coordinates
                const coords = document.getElementById('coordinates');
                coords.innerHTML = `
                    <span>X: ${Math.round(this.camera.position.x)}</span>
                    <span>Y: ${Math.round(this.camera.position.y)}</span>
                    <span>Z: ${Math.round(this.camera.position.z)}</span>
                `;
            }
            
            handleFileUpload(files) {
                Array.from(files).forEach((file, index) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const data = {
                            type: file.type.startsWith('video/') ? 'video' : 'image',
                            src: e.target.result,
                            title: file.name.replace(/\.[^/.]+$/, ""),
                            description: `Uploaded ${file.type.startsWith('video/') ? 'video' : 'image'} - A new memory added to your cosmic collection.`,
                            date: new Date().toISOString().split('T')[0],
                            location: 'Personal Collection',
                            emotion: 'Joy',
                            clarity: Math.floor(Math.random() * 20) + 80
                        };
                        
                        this.createMediaItem(data, this.mediaItems.length);
                        setTimeout(() => this.arrangeItems(), 100);
                    };
                    reader.readAsDataURL(file);
                });
            }
            
            animate() {
                requestAnimationFrame(() => this.animate());
                
                const time = Date.now() * 0.001;
                
                // Update camera based on mouse
                if (!this.controls.isMouseDown) {
                    this.camera.position.x += (this.controls.mouseX * 100 - this.camera.position.x) * 0.02;
                    this.camera.position.y += (-this.controls.mouseY * 100 - this.camera.position.y) * 0.02;
                }
                
                this.camera.lookAt(this.scene.position);
                
                // Rotate starfield
                if (this.starField) {
                    this.starField.rotation.y += 0.0002;
                    this.starField.rotation.x += 0.0001;
                }
                
                // Update nebula
                if (this.nebula) {
                    this.nebula.material.uniforms.time.value = time;
                }
                
                // Animate media items
                this.mediaItems.forEach((item) => {
                    const group = item.group;
                    const userData = group.userData;
                    
                    // Smooth movement to target position
                    if (userData.targetPosition) {
                        group.position.lerp(userData.targetPosition, 0.05);
                    }
                    
                    if (userData.targetRotation) {
                        group.rotation.x += (userData.targetRotation.x - group.rotation.x) * 0.05;
                        group.rotation.y += (userData.targetRotation.y - group.rotation.y) * 0.05;
                        group.rotation.z += (userData.targetRotation.z - group.rotation.z) * 0.05;
                    }
                    
                    // Floating animation
                    group.position.y = userData.originalY + Math.sin(time + userData.floatOffset) * 20;
                    
                    // Subtle rotation
                    group.rotation.z += userData.rotationSpeed;
                    
                    // Update hologram shader
                    if (item.mesh.material.uniforms) {
                        item.mesh.material.uniforms.time.value = time;
                    }
                    
                    // Update glow
                    if (item.glow && item.glow.material.uniforms) {
                        item.glow.material.uniforms.time.value = time;
                    }
                    
                    // Animate particles
                    if (item.mesh.userData.particles) {
                        const particles = item.mesh.userData.particles;
                        particles.rotation.y += 0.01;
                        const positions = particles.geometry.attributes.position.array;
                        for (let i = 0; i < positions.length; i += 3) {
                            positions[i + 1] += Math.sin(time + i) * 0.5;
                        }
                        particles.geometry.attributes.position.needsUpdate = true;
                    }
                });
                
                this.renderer.render(this.scene, this.camera);
            }
        }
        
        // Initialize the galaxy when DOM is loaded
        document.addEventListener('DOMContentLoaded', () => {
            new Galaxy3D();
        });
// ...removed extraneous </script>, </body>, </html> tags...