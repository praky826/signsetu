import * as THREE from "three";

/**
 * SignEngine – Universal Bone Mapping System
 * 
 * Now supports multiple bone naming conventions:
 * - Mixamo: mixamorig:RightArm, mixamorigRightArm
 * - ReadyPlayerMe: RightArm, Right_Arm
 * - Unity Humanoid: RightUpperArm, RightLowerArm
 * - Generic: right_arm, rightarm, r_arm
 */
export class SignEngine {
  constructor({ model }) {
    console.log("🚀 SignEngine: Initializing...");
    console.log("📦 Model received:", model);
    
    this.model = model;
    this.activeAnimations = [];

    // 1. Extract ALL bones from the model
    let rawBones = [];
    let skinnedMesh = null;
    
    // First priority: SkinnedMesh skeleton
    model.traverse(o => {
      if (o.isSkinnedMesh && o.skeleton) {
        console.log("✅ Found SkinnedMesh:", o.name);
        console.log("   └─ Skeleton has", o.skeleton.bones.length, "bones");
        skinnedMesh = o;
        rawBones = o.skeleton.bones;
      }
    });

    // Fallback: traverse hierarchy
    if (rawBones.length === 0) {
      console.warn("⚠️ No SkinnedMesh skeleton found. Using hierarchy traversal...");
      model.traverse(o => {
        if (o.isBone) {
          rawBones.push(o);
        }
      });
    }

    if (rawBones.length === 0) {
      console.error("❌ NO BONES FOUND IN MODEL!");
      console.log("Model structure:", model);
      throw new Error("No bones found. Model may not be rigged.");
    }

    console.log(`🦴 Found ${rawBones.length} total bones`);
    console.log("📋 All bone names:");
    rawBones.forEach((bone, i) => {
      console.log(`   ${i + 1}. ${bone.name}`);
    });

    // 2. Map bones using universal mapper
    this.bones = this._universalBoneMapper(rawBones);
    const mappedCount = Object.keys(this.bones).length;
    
    if (mappedCount === 0) {
      console.error("❌ FAILED TO MAP ANY BONES!");
      console.error("Your model's bone names don't match any known patterns.");
      console.error("Please check the bone names printed above.");
      throw new Error("Failed to map any bones. Check bone naming convention.");
    }

    console.log(`✅ Successfully mapped ${mappedCount} bones:`);
    Object.entries(this.bones).forEach(([canonical, bone]) => {
      console.log(`   ${canonical} → ${bone.name}`);
    });

    // 3. Store rest pose
    this.restPose = {};
    Object.entries(this.bones).forEach(([name, bone]) => {
      bone.matrixAutoUpdate = true;
      this.restPose[name] = {
        quaternion: bone.quaternion.clone(),
        position: bone.position.clone()
      };
    });

    // 4. Start animation loop
    this._tick = this._tick.bind(this);
    this._tick();

    // Make globally accessible for debugging
    window.signEngine = this;

    // 5. Run startup test
    console.log("⏳ Running startup test in 1.5 seconds...");
    setTimeout(() => this.startupSequence(), 1500);
  }

  /**
   * Universal bone mapper that handles multiple naming conventions
   */
  _universalBoneMapper(boneList) {
    const mapped = {};

    // Create a lookup map of all bones
    const boneMap = new Map();
    boneList.forEach(bone => {
      boneMap.set(bone.name, bone);
    });

    /**
     * Try to find a bone using multiple naming patterns
     */
    const findBone = (patterns) => {
      for (const pattern of patterns) {
        // Try exact match first
        if (boneMap.has(pattern)) {
          return boneMap.get(pattern);
        }
        
        // Try case-insensitive match
        for (const [name, bone] of boneMap) {
          if (name.toLowerCase() === pattern.toLowerCase()) {
            return bone;
          }
        }
        
        // Try partial match (contains)
        for (const [name, bone] of boneMap) {
          const nameLower = name.toLowerCase();
          const patternLower = pattern.toLowerCase();
          
          // Remove common prefixes for comparison
          const cleanName = nameLower
            .replace(/^(mixamorig|mixamo|rig|armature)[:\-_]?/i, '')
            .replace(/[^a-z0-9]/g, '');
          const cleanPattern = patternLower.replace(/[^a-z0-9]/g, '');
          
          if (cleanName === cleanPattern || cleanName.endsWith(cleanPattern)) {
            return bone;
          }
        }
      }
      return null;
    };

    // Define bone patterns for each canonical name
    // Each array contains multiple possible names for that bone
    const boneDefinitions = {
      // === Body/Spine ===
      Hips: [
        'Hips', 'hips', 'Hip', 'hip',
        'mixamorigHips', 'mixamorig:Hips',
        'Pelvis', 'pelvis', 'Root', 'root'
      ],
      
      Spine: [
        'Spine', 'spine', 'Spine1', 'spine1',
        'mixamorigSpine', 'mixamorig:Spine',
        'Spine_01', 'spine_01'
      ],
      
      Spine1: [
        'Spine1', 'spine1', 'Spine2', 'spine2',
        'mixamorigSpine1', 'mixamorig:Spine1',
        'Spine_02', 'spine_02', 'Chest', 'chest'
      ],
      
      Spine2: [
        'Spine2', 'spine2', 'Spine3', 'spine3',
        'mixamorigSpine2', 'mixamorig:Spine2',
        'Spine_03', 'spine_03', 'UpperChest', 'upperchest'
      ],
      
      Neck: [
        'Neck', 'neck',
        'mixamorigNeck', 'mixamorig:Neck',
        'Neck_01', 'neck_01'
      ],
      
      Head: [
        'Head', 'head',
        'mixamorigHead', 'mixamorig:Head',
        'Head_01', 'head_01'
      ],

      // === Right Arm ===
      RightShoulder: [
        'RightShoulder', 'rightshoulder', 'Right_Shoulder', 'right_shoulder',
        'mixamorigRightShoulder', 'mixamorig:RightShoulder',
        'RightClavicle', 'rightclavicle', 'Right_Clavicle'
      ],
      
      RightArm: [
        'RightArm', 'rightarm', 'Right_Arm', 'right_arm',
        'mixamorigRightArm', 'mixamorig:RightArm',
        'RightUpperArm', 'rightupperarm', 'Right_Upper_Arm',
        'RightShoulder', 'R_Arm', 'r_arm'
      ],
      
      RightForeArm: [
        'RightForeArm', 'rightforearm', 'Right_ForeArm', 'right_forearm',
        'mixamorigRightForeArm', 'mixamorig:RightForeArm',
        'RightLowerArm', 'rightlowerarm', 'Right_Lower_Arm',
        'R_ForeArm', 'r_forearm'
      ],
      
      RightHand: [
        'RightHand', 'righthand', 'Right_Hand', 'right_hand',
        'mixamorigRightHand', 'mixamorig:RightHand',
        'R_Hand', 'r_hand'
      ],

      // === Left Arm ===
      LeftShoulder: [
        'LeftShoulder', 'leftshoulder', 'Left_Shoulder', 'left_shoulder',
        'mixamorigLeftShoulder', 'mixamorig:LeftShoulder',
        'LeftClavicle', 'leftclavicle', 'Left_Clavicle'
      ],
      
      LeftArm: [
        'LeftArm', 'leftarm', 'Left_Arm', 'left_arm',
        'mixamorigLeftArm', 'mixamorig:LeftArm',
        'LeftUpperArm', 'leftupperarm', 'Left_Upper_Arm',
        'LeftShoulder', 'L_Arm', 'l_arm'
      ],
      
      LeftForeArm: [
        'LeftForeArm', 'leftforearm', 'Left_ForeArm', 'left_forearm',
        'mixamorigLeftForeArm', 'mixamorig:LeftForeArm',
        'LeftLowerArm', 'leftlowerarm', 'Left_Lower_Arm',
        'L_ForeArm', 'l_forearm'
      ],
      
      LeftHand: [
        'LeftHand', 'lefthand', 'Left_Hand', 'left_hand',
        'mixamorigLeftHand', 'mixamorig:LeftHand',
        'L_Hand', 'l_hand'
      ],
    };

    // Add finger bones for both hands
    ['Right', 'Left'].forEach(side => {
      const sideShort = side.charAt(0); // R or L
      ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'].forEach(finger => {
        [1, 2, 3, 4].forEach(joint => {
          const canonicalName = `${side}Hand${finger}${joint}`;
          const patterns = [
            `${side}Hand${finger}${joint}`,
            `${side}_Hand_${finger}${joint}`,
            `${side}Hand${finger}_${joint}`,
            `mixamorig${side}Hand${finger}${joint}`,
            `mixamorig:${side}Hand${finger}${joint}`,
            `${sideShort}_${finger}${joint}`,
            `${sideShort}_${finger}_${joint}`,
            `${side}${finger}${joint}`,
            `${side.toLowerCase()}hand${finger.toLowerCase()}${joint}`,
          ];
          boneDefinitions[canonicalName] = patterns;
        });
      });
    });

    // Map each bone
    let criticalMissing = [];
    Object.entries(boneDefinitions).forEach(([canonicalName, patterns]) => {
      const bone = findBone(patterns);
      if (bone) {
        mapped[canonicalName] = bone;
      } else {
        // Track critical missing bones (not fingers)
        if (!canonicalName.includes('Thumb') && 
            !canonicalName.includes('Index') && 
            !canonicalName.includes('Middle') && 
            !canonicalName.includes('Ring') && 
            !canonicalName.includes('Pinky')) {
          criticalMissing.push(canonicalName);
        }
      }
    });

    // Warn about critical missing bones
    if (criticalMissing.length > 0) {
      console.warn("⚠️ Some important bones not found:", criticalMissing.join(", "));
      console.warn("Animation may be limited.");
    }

    return mapped;
  }

  /**
   * Startup test sequence
   */
  startupSequence() {
    console.log("👋 STARTUP TEST: Making obvious movements...");
    
    try {
      // Test 1: Tilt body if possible
      if (this.bones.Hips) {
        console.log("   1. Tilting hips...");
        this.rotate("Hips", 0, 0, 0.3, 0.2);
      } else if (this.bones.Spine) {
        console.log("   1. Tilting spine...");
        this.rotate("Spine", 0, 0, 0.3, 0.2);
      }

      // Test 2: Raise right arm
      if (this.bones.RightArm) {
        console.log("   2. Raising right arm...");
        this.rotate("RightArm", -1.2, 0, 0.5, 0.2);
      }

      // Test 3: Bend right forearm
      if (this.bones.RightForeArm) {
        console.log("   3. Bending right forearm...");
        this.rotate("RightForeArm", 0, -1.5, 0, 0.2);
      }

      // Test 4: Try hand if we have finger bones
      const hasFingers = this.bones.RightHandIndex1 || this.bones.RightHandThumb1;
      if (hasFingers) {
        console.log("   4. Making fist...");
        this.hand("fist");
      }

      // Reset after 3 seconds
      setTimeout(() => {
        console.log("   5. Resetting to rest pose...");
        this.resetAll();
      }, 3000);
      
    } catch (e) {
      console.error("❌ Startup test failed:", e);
    }
  }

  /**
   * Animation tick
   */
  _tick() {
    requestAnimationFrame(this._tick);
    
    for (let i = this.activeAnimations.length - 1; i >= 0; i--) {
      const anim = this.activeAnimations[i];
      if (!anim.bone) continue;
      
      anim.bone.quaternion.slerp(anim.target, anim.speed);
      
      const angleDiff = anim.bone.quaternion.angleTo(anim.target);
      if (angleDiff < 0.01) {
        anim.bone.quaternion.copy(anim.target);
        this.activeAnimations.splice(i, 1);
      }
    }
  }

  /**
   * Rotate a bone
   */
  rotate(name, x, y, z, speed = 0.15) {
    const bone = this.bones[name];
    if (!bone) {
      console.warn(`⚠️ Bone "${name}" not mapped`);
      return;
    }

    const rest = this.restPose[name].quaternion;
    const delta = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(x, y, z, 'XYZ')
    );
    const target = rest.clone().multiply(delta);

    this.activeAnimations = this.activeAnimations.filter(a => a.bone !== bone);
    this.activeAnimations.push({
      bone,
      target,
      speed: Math.max(0.05, Math.min(0.5, speed))
    });
  }

  /**
   * Reset bone to rest pose
   */
  reset(name) {
    const bone = this.bones[name];
    if (!bone) return;
    
    const rest = this.restPose[name].quaternion;
    this.activeAnimations = this.activeAnimations.filter(a => a.bone !== bone);
    this.activeAnimations.push({
      bone,
      target: rest.clone(),
      speed: 0.15
    });
  }

  /**
   * Reset all bones
   */
  resetAll() {
    Object.keys(this.bones).forEach(name => this.reset(name));
  }

  // ================= HIGH-LEVEL POSES =================

  /**
   * Move right arm to location
   */
  armTo(location) {
    // Reset forearm first
    if (this.bones.RightForeArm) {
      this.reset("RightForeArm");
    }
    
    if (!this.bones.RightArm) {
      console.warn("⚠️ RightArm bone not found, cannot move arm");
      return;
    }
    
    switch (location) {
      case "chest":
        this.rotate("RightArm", -0.6, 0, 0.8, 0.2);
        if (this.bones.RightForeArm) {
          this.rotate("RightForeArm", 0, -2.0, 0, 0.2);
        }
        break;
        
      case "chin":
        this.rotate("RightArm", -0.9, 0, 0.4, 0.2);
        if (this.bones.RightForeArm) {
          this.rotate("RightForeArm", 0, -2.3, 0, 0.2);
        }
        break;
        
      case "head":
        this.rotate("RightArm", -1.1, 0, 0.1, 0.2);
        if (this.bones.RightForeArm) {
          this.rotate("RightForeArm", 0, -2.5, 0, 0.2);
        }
        break;
        
      case "stomach":
        this.rotate("RightArm", -0.3, 0, 1.3, 0.2);
        if (this.bones.RightForeArm) {
          this.rotate("RightForeArm", 0, -1.3, 0, 0.2);
        }
        break;
        
      case "forward":
        this.rotate("RightArm", -1.4, 0, 0.6, 0.2);
        if (this.bones.RightForeArm) {
          this.rotate("RightForeArm", 0, -0.3, 0, 0.2);
        }
        break;
    }
  }

  /**
   * Set palm orientation
   */
  palm(orientation) {
    if (!this.bones.RightHand) {
      console.warn("⚠️ RightHand bone not found");
      return;
    }
    
    switch (orientation) {
      case "down":
        this.rotate("RightHand", 1.6, 0, 0, 0.2);
        break;
      case "up":
        this.rotate("RightHand", -1.6, 0, 0, 0.2);
        break;
      case "left":
        this.rotate("RightHand", 0, 0, -1.6, 0.2);
        break;
      case "right":
        this.rotate("RightHand", 0, 0, 1.6, 0.2);
        break;
      case "forward":
        this.reset("RightHand");
        break;
    }
  }

  /**
   * Set hand shape
   */
  hand(shape) {
    const side = "Right";
    
    // Check if we have any finger bones
    const hasFingers = !!(
      this.bones.RightHandIndex1 ||
      this.bones.RightHandThumb1 ||
      this.bones.RightHandMiddle1
    );
    
    if (!hasFingers) {
      console.warn("⚠️ No finger bones found, cannot make hand shapes");
      return;
    }
    
    /**
     * Curl a finger
     */
    const curl = (finger, amount) => {
      const curlAngle = amount * (finger === "Thumb" ? 1.0 : 1.8);
      
      [1, 2, 3].forEach(joint => {
        const boneName = `${side}Hand${finger}${joint}`;
        if (this.bones[boneName]) {
          // Try different rotation axes (models vary)
          this.rotate(boneName, -curlAngle, 0, 0, 0.2);
        }
      });
    };

    switch (shape) {
      case "flat":
        ["Thumb", "Index", "Middle", "Ring", "Pinky"].forEach(f => curl(f, 0));
        break;
        
      case "fist":
        ["Thumb", "Index", "Middle", "Ring", "Pinky"].forEach(f => curl(f, 1));
        break;
        
      case "index":
        curl("Index", 0);
        ["Middle", "Ring", "Pinky", "Thumb"].forEach(f => curl(f, 1));
        break;
        
      case "vee":
        curl("Index", 0);
        curl("Middle", 0);
        ["Ring", "Pinky", "Thumb"].forEach(f => curl(f, 1));
        break;
        
      case "pinch":
        curl("Index", 0.5);
        curl("Thumb", 0.5);
        ["Middle", "Ring", "Pinky"].forEach(f => curl(f, 0.2));
        break;
        
      case "cee":
        ["Index", "Middle", "Ring", "Pinky"].forEach(f => curl(f, 0.6));
        curl("Thumb", 0.4);
        break;
        
      case "thumbup":
        curl("Thumb", 0);
        ["Index", "Middle", "Ring", "Pinky"].forEach(f => curl(f, 1));
        break;
    }
  }
}