  // frontend/autoBoneMapper.js

/**
 * Auto-map bones for Mixamo/ReadyPlayerMe models to SignEngine canonical names.
 *
 * Mixamo bone names come in several formats:
 *   - "mixamorigRightArm"         (no separator)
 *   - "mixamorig:RightArm"        (colon separator)
 *   - "mixamorig_RightArm"        (underscore separator)
 *   - "RightArm"                  (bare name, some exports)
 *
 * This mapper normalizes everything and matches against known patterns.
 *
 * @param {THREE.Object3D} model - Loaded 3D model
 * @returns {Object} bones - { canonicalName: THREE.Bone }
 */
export function autoMapBones(model) {
  const bones = {};

  // Gather all bones from the model
  const modelBones = [];
  model.traverse(obj => {
    if (obj.isBone) {
      modelBones.push(obj);
    }
  });

  console.log(`🦴 AutoMapper: Found ${modelBones.length} bones in model`);
  console.log("🦴 Raw bone names:", modelBones.map(b => b.name).join(", "));

  // Canonical bone name → array of possible patterns (all will be lowercased for matching)
  const bonePatterns = {
    // === Spine / Body ===
    "Hips": ["hips"],
    "Spine": ["spine"],
    "Spine1": ["spine1"],
    "Spine2": ["spine2"],
    "Neck": ["neck"],
    "Head": ["head"],

    // === Right Arm ===
    "RightShoulder": ["rightshoulder"],
    "RightArm": ["rightarm", "rightupperarm"],
    "RightForeArm": ["rightforearm", "rightlowerarm"],
    "RightHand": ["righthand"],

    // === Right Fingers ===
    "RightHandThumb1": ["righthandthumb1"],
    "RightHandThumb2": ["righthandthumb2"],
    "RightHandThumb3": ["righthandthumb3"],
    "RightHandThumb4": ["righthandthumb4"],

    "RightHandIndex1": ["righthandindex1"],
    "RightHandIndex2": ["righthandindex2"],
    "RightHandIndex3": ["righthandindex3"],
    "RightHandIndex4": ["righthandindex4"],

    "RightHandMiddle1": ["righthandmiddle1"],
    "RightHandMiddle2": ["righthandmiddle2"],
    "RightHandMiddle3": ["righthandmiddle3"],
    "RightHandMiddle4": ["righthandmiddle4"],

    "RightHandRing1": ["righthandring1"],
    "RightHandRing2": ["righthandring2"],
    "RightHandRing3": ["righthandring3"],
    "RightHandRing4": ["righthandring4"],

    "RightHandPinky1": ["righthandpinky1"],
    "RightHandPinky2": ["righthandpinky2"],
    "RightHandPinky3": ["righthandpinky3"],
    "RightHandPinky4": ["righthandpinky4"],

    // === Left Arm ===
    "LeftShoulder": ["leftshoulder"],
    "LeftArm": ["leftarm", "leftupperarm"],
    "LeftForeArm": ["leftforearm", "leftlowerarm"],
    "LeftHand": ["lefthand"],

    // === Left Fingers ===
    "LeftHandThumb1": ["lefthandthumb1"],
    "LeftHandThumb2": ["lefthandthumb2"],
    "LeftHandThumb3": ["lefthandthumb3"],
    "LeftHandThumb4": ["lefthandthumb4"],

    "LeftHandIndex1": ["lefthandindex1"],
    "LeftHandIndex2": ["lefthandindex2"],
    "LeftHandIndex3": ["lefthandindex3"],
    "LeftHandIndex4": ["lefthandindex4"],

    "LeftHandMiddle1": ["lefthandmiddle1"],
    "LeftHandMiddle2": ["lefthandmiddle2"],
    "LeftHandMiddle3": ["lefthandmiddle3"],
    "LeftHandMiddle4": ["lefthandmiddle4"],

    "LeftHandRing1": ["lefthandring1"],
    "LeftHandRing2": ["lefthandring2"],
    "LeftHandRing3": ["lefthandring3"],
    "LeftHandRing4": ["lefthandring4"],

    "LeftHandPinky1": ["lefthandpinky1"],
    "LeftHandPinky2": ["lefthandpinky2"],
    "LeftHandPinky3": ["lefthandpinky3"],
    "LeftHandPinky4": ["lefthandpinky4"],

    // === Legs (for future use) ===
    "RightUpLeg": ["rightupleg"],
    "RightLeg": ["rightleg"],
    "RightFoot": ["rightfoot"],
    "RightToeBase": ["righttoebase"],

    "LeftUpLeg": ["leftupleg"],
    "LeftLeg": ["leftleg"],
    "LeftFoot": ["leftfoot"],
    "LeftToeBase": ["lefttoebase"],
  };

  /**
   * Normalize a bone name by:
   * 1. Removing "mixamorig" prefix (with optional colon/underscore separator)
   * 2. Lowercasing everything
   * 3. Stripping all non-alphanumeric characters
   */
  const normalize = (name) => {
    return name
      .replace(/^mixamorig[:\-_]?/i, "")  // strip Mixamo prefix
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  };

  // Pre-normalize all model bone names for faster lookup
  const normalizedModelBones = modelBones.map(b => ({
    bone: b,
    normalized: normalize(b.name)
  }));

  // Map each canonical name
  let mappedCount = 0;
  let unmappedBones = [];

  Object.entries(bonePatterns).forEach(([canonicalName, patterns]) => {
    // Try each pattern
    for (const pattern of patterns) {
      const match = normalizedModelBones.find(b => b.normalized === pattern);
      if (match) {
        bones[canonicalName] = match.bone;
        mappedCount++;
        return;
      }
    }

    // If no exact match, try partial matching (canonical name in bone name)
    const canonNorm = normalize(canonicalName);
    const partialMatch = normalizedModelBones.find(b =>
      b.normalized === canonNorm ||
      b.normalized.endsWith(canonNorm)
    );

    if (partialMatch) {
      bones[canonicalName] = partialMatch.bone;
      mappedCount++;
    } else {
      unmappedBones.push(canonicalName);
    }
  });

  console.log(`✅ AutoMapper: Mapped ${mappedCount}/${Object.keys(bonePatterns).length} bones`);

  if (unmappedBones.length > 0) {
    // Only warn about important unmapped bones (not leg bones etc.)
    const importantMissing = unmappedBones.filter(b =>
      b.includes("Hand") || b.includes("Arm") || b.includes("Spine") ||
      b.includes("Head") || b.includes("Neck") || b.includes("Shoulder")
    );
    if (importantMissing.length > 0) {
      console.warn("⚠ Important unmapped bones:", importantMissing.join(", "));
    }
  }

  return bones;
}
