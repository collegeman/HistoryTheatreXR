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

// Accumulate world rest quaternions through the bone hierarchy only.
// Non-bone ancestors (Armature, Scene) are skipped so the result
// reflects bone-to-bone orientation, independent of scene placement.
function collectBoneWorldRestPoses(root: Object3D): Map<string, Quaternion> {
    const worldPoses = new Map<string, Quaternion>();

    function traverse(node: Object3D, parentBoneWorldQ: Quaternion) {
        const isBone = (node as Bone).isBone;
        const boneWorldQ = isBone
            ? parentBoneWorldQ.clone().multiply(node.quaternion)
            : parentBoneWorldQ;

        if (isBone) {
            worldPoses.set(node.name, boneWorldQ.clone());
        }

        for (const child of node.children) {
            traverse(child, boneWorldQ);
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

export function retargetClip(
    clip: AnimationClip,
    boneMap: BoneMap,
    sourceLocalRest: Map<string, Quaternion>,
    sourceWorldRest: Map<string, Quaternion>,
    rootTrackValues: Float32Array | null,
): AnimationClip {
    const tracks: KeyframeTrack[] = [];

    for (const track of clip.tracks) {
        const parsed = parseTrack(track.name);
        if (!parsed) continue;
        if (parsed.property !== 'quaternion') continue;

        const targetBoneRaw = boneMap[parsed.bone];
        if (!targetBoneRaw) continue;

        const targetBone = PropertyBinding.sanitizeNodeName(targetBoneRaw);
        const newName = targetBone + '.quaternion';

        const R = sourceLocalRest.get(parsed.bone);
        const W = sourceWorldRest.get(parsed.bone);

        if (!R || !W) {
            tracks.push(
                new QuaternionKeyframeTrack(
                    newName,
                    Array.from(track.times),
                    Array.from(track.values),
                ),
            );
            continue;
        }

        // W_parent = W * inv(R): the world rest of the parent bone chain
        // inv(W): inverse of this bone's world rest
        //
        // For the pelvis we bake the root bone's animation in, because the
        // source has root→pelvis while the target has Hips as root.
        const isPelvis = parsed.bone === 'pelvis';
        const rootLocalRest = sourceLocalRest.get('root');

        let wParent: Quaternion;
        if (isPelvis && rootLocalRest && rootTrackValues) {
            const rCombined = rootLocalRest.clone().multiply(R);
            wParent = W.clone().multiply(rCombined.clone().invert());
        } else {
            wParent = W.clone().multiply(R.clone().invert());
        }
        const wInv = W.clone().invert();

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

            if (isPelvis && rootTrackValues) {
                rootQ.set(
                    rootTrackValues[i],
                    rootTrackValues[i + 1],
                    rootTrackValues[i + 2],
                    rootTrackValues[i + 3],
                );
                srcQ.premultiply(rootQ);
            }

            // Hierarchy-aware retarget:
            //   target = W_parent * Q_anim * inv(W)
            //
            // This conjugates the parent-space delta (Q * inv(R)) by W_parent,
            // correctly transforming the rotation axis from the source bone's
            // rest-oriented frame into the target's identity-rest frame.
            outQ.copy(wParent).multiply(srcQ).multiply(wInv);
            values[i] = outQ.x;
            values[i + 1] = outQ.y;
            values[i + 2] = outQ.z;
            values[i + 3] = outQ.w;
        }

        tracks.push(
            new QuaternionKeyframeTrack(newName, Array.from(track.times), Array.from(values)),
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
    const sourceLocalRest = collectBoneLocalRestPoses(sourceModel);
    const sourceWorldRest = collectBoneWorldRestPoses(sourceModel);

    return clips.map((clip) => {
        const rootTrackValues = collectQuaternionTrack(clip, 'root');
        return retargetClip(clip, boneMap, sourceLocalRest, sourceWorldRest, rootTrackValues);
    });
}

export { UAL_TO_MIXAMO };
