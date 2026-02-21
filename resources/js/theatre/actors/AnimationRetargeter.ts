import {
    AnimationClip,
    Bone,
    KeyframeTrack,
    PropertyBinding,
    Quaternion,
    QuaternionKeyframeTrack,
    type Object3D,
} from 'three';

export type BoneMap = Record<string, string>;

const UAL_TO_MIXAMO: BoneMap = {
    'pelvis': 'mixamorig:Hips',
    'spine_01': 'mixamorig:Spine',
    'spine_02': 'mixamorig:Spine1',
    'spine_03': 'mixamorig:Spine2',
    'neck_01': 'mixamorig:Neck',
    'Head': 'mixamorig:Head',

    'clavicle_l': 'mixamorig:LeftShoulder',
    'upperarm_l': 'mixamorig:LeftArm',
    'lowerarm_l': 'mixamorig:LeftForeArm',
    'hand_l': 'mixamorig:LeftHand',
    'thumb_01_l': 'mixamorig:LeftHandThumb1',
    'thumb_02_l': 'mixamorig:LeftHandThumb2',
    'thumb_03_l': 'mixamorig:LeftHandThumb3',
    'index_01_l': 'mixamorig:LeftHandIndex1',
    'index_02_l': 'mixamorig:LeftHandIndex2',
    'index_03_l': 'mixamorig:LeftHandIndex3',
    'middle_01_l': 'mixamorig:LeftHandMiddle1',
    'middle_02_l': 'mixamorig:LeftHandMiddle2',
    'middle_03_l': 'mixamorig:LeftHandMiddle3',
    'ring_01_l': 'mixamorig:LeftHandRing1',
    'ring_02_l': 'mixamorig:LeftHandRing2',
    'ring_03_l': 'mixamorig:LeftHandRing3',
    'pinky_01_l': 'mixamorig:LeftHandPinky1',
    'pinky_02_l': 'mixamorig:LeftHandPinky2',
    'pinky_03_l': 'mixamorig:LeftHandPinky3',

    'clavicle_r': 'mixamorig:RightShoulder',
    'upperarm_r': 'mixamorig:RightArm',
    'lowerarm_r': 'mixamorig:RightForeArm',
    'hand_r': 'mixamorig:RightHand',
    'thumb_01_r': 'mixamorig:RightHandThumb1',
    'thumb_02_r': 'mixamorig:RightHandThumb2',
    'thumb_03_r': 'mixamorig:RightHandThumb3',
    'index_01_r': 'mixamorig:RightHandIndex1',
    'index_02_r': 'mixamorig:RightHandIndex2',
    'index_03_r': 'mixamorig:RightHandIndex3',
    'middle_01_r': 'mixamorig:RightHandMiddle1',
    'middle_02_r': 'mixamorig:RightHandMiddle2',
    'middle_03_r': 'mixamorig:RightHandMiddle3',
    'ring_01_r': 'mixamorig:RightHandRing1',
    'ring_02_r': 'mixamorig:RightHandRing2',
    'ring_03_r': 'mixamorig:RightHandRing3',
    'pinky_01_r': 'mixamorig:RightHandPinky1',
    'pinky_02_r': 'mixamorig:RightHandPinky2',
    'pinky_03_r': 'mixamorig:RightHandPinky3',

    'thigh_l': 'mixamorig:LeftUpLeg',
    'calf_l': 'mixamorig:LeftLeg',
    'foot_l': 'mixamorig:LeftFoot',
    'ball_l': 'mixamorig:LeftToeBase',

    'thigh_r': 'mixamorig:RightUpLeg',
    'calf_r': 'mixamorig:RightLeg',
    'foot_r': 'mixamorig:RightFoot',
    'ball_r': 'mixamorig:RightToeBase',
};

function collectBoneLocalRestPoses(root: Object3D): Map<string, Quaternion> {
    const poses = new Map<string, Quaternion>();
    root.traverse((node) => {
        if ((node as Bone).isBone) {
            poses.set(node.name, node.quaternion.clone());
        }
    });
    return poses;
}

// Accumulate world rest quaternions through the full ancestor chain.
// Non-bone ancestors (Armature nodes) may carry coordinate-system
// rotations (e.g. Z-up → Y-up) that must be included so source and
// target bone worlds are in the same scene-space frame.
function collectBoneWorldRestPoses(root: Object3D): Map<string, Quaternion> {
    const worldPoses = new Map<string, Quaternion>();

    function traverse(node: Object3D, parentWorldQ: Quaternion) {
        const worldQ = parentWorldQ.clone().multiply(node.quaternion);

        if ((node as Bone).isBone) {
            worldPoses.set(node.name, worldQ.clone());
        }

        for (const child of node.children) {
            traverse(child, worldQ);
        }
    }

    traverse(root, new Quaternion());
    return worldPoses;
}

function parseTrack(trackName: string): { bone: string; property: string } | null {
    const dotIndex = trackName.indexOf('.');
    if (dotIndex === -1) return null;
    return {
        bone: trackName.substring(0, dotIndex),
        property: trackName.substring(dotIndex + 1),
    };
}

function collectQuaternionTrack(
    clip: AnimationClip,
    boneName: string,
): Float32Array | null {
    for (const track of clip.tracks) {
        const parsed = parseTrack(track.name);
        if (parsed && parsed.bone === boneName && parsed.property === 'quaternion') {
            return track.values as Float32Array;
        }
    }
    return null;
}

// Precomputed per-bone data for the retarget inner loop.
interface BoneRetargetInfo {
    targetTrackName: string;
    wSourceParent: Quaternion;
    wSourceInv: Quaternion;
    wTarget: Quaternion;
    wTargetParentInv: Quaternion;
    isPelvis: boolean;
}

function buildBoneInfo(
    sourceBone: string,
    boneMap: BoneMap,
    srcLocal: Map<string, Quaternion>,
    srcWorld: Map<string, Quaternion>,
    tgtLocal: Map<string, Quaternion>,
    tgtWorld: Map<string, Quaternion>,
    rootTrackValues: Float32Array | null,
): BoneRetargetInfo | null {
    const targetBoneRaw = boneMap[sourceBone];
    if (!targetBoneRaw) return null;

    const targetBone = PropertyBinding.sanitizeNodeName(targetBoneRaw);
    const Rsrc = srcLocal.get(sourceBone);
    const Wsrc = srcWorld.get(sourceBone);
    const Rtgt = tgtLocal.get(targetBone);
    const Wtgt = tgtWorld.get(targetBone);

    if (!Rsrc || !Wsrc) return null;

    const isPelvis = sourceBone === 'pelvis';
    const rootLocalRest = srcLocal.get('root');

    // Source: W_parent = W * inv(R)
    let wSourceParent: Quaternion;
    if (isPelvis && rootLocalRest && rootTrackValues) {
        const rCombined = rootLocalRest.clone().multiply(Rsrc);
        wSourceParent = Wsrc.clone().multiply(rCombined.clone().invert());
    } else {
        wSourceParent = Wsrc.clone().multiply(Rsrc.clone().invert());
    }

    // Target: W_parent = W * inv(R), default to identity if bone not found
    const wtgt = Wtgt?.clone() ?? new Quaternion();
    const rtgt = Rtgt?.clone() ?? new Quaternion();
    const wTargetParentInv = wtgt.clone().multiply(rtgt.clone().invert()).invert();

    return {
        targetTrackName: targetBone + '.quaternion',
        wSourceParent,
        wSourceInv: Wsrc.clone().invert(),
        wTarget: wtgt,
        wTargetParentInv,
        isPelvis,
    };
}

export function retargetClip(
    clip: AnimationClip,
    boneMap: BoneMap,
    srcLocal: Map<string, Quaternion>,
    srcWorld: Map<string, Quaternion>,
    tgtLocal: Map<string, Quaternion>,
    tgtWorld: Map<string, Quaternion>,
    rootTrackValues: Float32Array | null,
): AnimationClip {
    const tracks: KeyframeTrack[] = [];

    for (const track of clip.tracks) {
        const parsed = parseTrack(track.name);
        if (!parsed) continue;
        if (parsed.property !== 'quaternion') continue;

        const info = buildBoneInfo(
            parsed.bone, boneMap, srcLocal, srcWorld, tgtLocal, tgtWorld, rootTrackValues,
        );
        if (!info) continue;

        const values = new Float32Array(track.values.length);
        const srcQ = new Quaternion();
        const rootQ = new Quaternion();
        const outQ = new Quaternion();

        for (let i = 0; i < track.values.length; i += 4) {
            srcQ.set(
                track.values[i],
                track.values[i + 1],
                track.values[i + 2],
                track.values[i + 3],
            );

            if (info.isPelvis && rootTrackValues) {
                rootQ.set(
                    rootTrackValues[i],
                    rootTrackValues[i + 1],
                    rootTrackValues[i + 2],
                    rootTrackValues[i + 3],
                );
                srcQ.premultiply(rootQ);
            }

            // General hierarchy-aware retarget formula:
            //   target = inv(W_tgt_parent) * W_src_parent * Q * inv(W_src) * W_tgt
            //
            // Reduces to W_src_parent * Q * inv(W_src) when target rest = identity.
            outQ.copy(info.wTargetParentInv)
                .multiply(info.wSourceParent)
                .multiply(srcQ)
                .multiply(info.wSourceInv)
                .multiply(info.wTarget);

            values[i] = outQ.x;
            values[i + 1] = outQ.y;
            values[i + 2] = outQ.z;
            values[i + 3] = outQ.w;
        }

        tracks.push(
            new QuaternionKeyframeTrack(
                info.targetTrackName,
                Array.from(track.times),
                Array.from(values),
            ),
        );
    }

    return new AnimationClip(clip.name, clip.duration, tracks);
}

export function retargetClips(
    clips: AnimationClip[],
    boneMap: BoneMap,
    sourceModel: Object3D,
    targetModel: Object3D,
): AnimationClip[] {
    const srcLocal = collectBoneLocalRestPoses(sourceModel);
    const srcWorld = collectBoneWorldRestPoses(sourceModel);
    const tgtLocal = collectBoneLocalRestPoses(targetModel);
    const tgtWorld = collectBoneWorldRestPoses(targetModel);

    return clips.map((clip) => {
        const rootTrackValues = collectQuaternionTrack(clip, 'root');
        return retargetClip(
            clip, boneMap, srcLocal, srcWorld, tgtLocal, tgtWorld, rootTrackValues,
        );
    });
}

export { UAL_TO_MIXAMO };
