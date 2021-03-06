module.exports = ({THREE, BLOCK_BUFFER_SIZE}) => {

const NUM_POSITIONS_CHUNK = 100 * 1024;
const MASK_SIZE = 4096;
const colors = new Uint32Array(MASK_SIZE);
const invColors = new Uint32Array(MASK_SIZE);
const mask = new Uint8Array(MASK_SIZE);
const invMask = new Uint8Array(MASK_SIZE);

function tesselate(voxels, dims, {isTransparent, isTranslucent, getFaceUvs}) {
  const {vertices: verticesData, faces: facesData} = getMeshData(voxels, dims, {isTransparent, isTranslucent});

  const positions = getPositions(verticesData);
  const normals = getNormals(positions);
  const uvs = getUvs(facesData, normals, {getFaceUvs});
  const ssaos = getSsaos(verticesData, voxels);
  return {positions, /*normals, */uvs, ssaos};
}

function getMeshData(voxels, dims, {isTransparent, isTranslucent}) {
  const vertices = new Float32Array(NUM_POSITIONS_CHUNK);
  const faces = new Uint32Array(NUM_POSITIONS_CHUNK);
  const tVertices = new Float32Array(NUM_POSITIONS_CHUNK);
  const tFaces = new Uint32Array(NUM_POSITIONS_CHUNK);
  let vertexIndex = 0;
  let faceIndex = 0;
  let tVertexIndex = 0;
  let tFaceIndex = 0;

  const dimsX = dims[0];
  const dimsY = dims[1];
  const dimsXY = dimsX * dimsY;

  //Sweep over 3-axes
  for(var d=0; d<3; ++d) {
    var i, j, k, l, w, W, h, n, c
      , u = (d+1)%3
      , v = (d+2)%3
      , x = [0,0,0]
      , q = [0,0,0]
      , du = [0,0,0]
      , dv = [0,0,0]
      , dimsD = dims[d]
      , dimsU = dims[u]
      , dimsV = dims[v]
      , qdimsX, qdimsXY
      , xd
      , t

    q[d] =  1;
    x[d] = -1;

    qdimsX  = dimsX  * q[1]
    qdimsXY = dimsXY * q[2]

    if (MASK_SIZE < dimsU * dimsV) {
      throw new Error('mask buffer not big enough');
    }

    // Compute mask
    while (x[d] < dimsD) {
      xd = x[d]
      n = 0;

      for(x[v] = 0; x[v] < dimsV; ++x[v]) {
        for(x[u] = 0; x[u] < dimsU; ++x[u], ++n) {
          let a, b;
          if (xd >= 0) {
            const aOffset = x[0]      + dimsX * x[1]          + dimsXY * x[2];
            a = voxels[aOffset];
          } else {
            a = 0;
          }
          if (xd < dimsD-1) {
            const bOffset = x[0]+q[0] + dimsX * x[1] + qdimsX + dimsXY * x[2] + qdimsXY;
            b = voxels[bOffset];
          } else {
            b = 0;
          }

          let aMask, bMask;
          if (a !== b || isTranslucent(a) || isTranslucent(b)) {
            const aT = isTransparent(a);
            const bT = isTransparent(b);

            aMask = +(aMask || aT);
            bMask = +(bMask || bT);

            // both are transparent, add to both directions
            if (aT && bT) {
              // nothing
            // if a is solid and b is not there or transparent
            } else if (a && (!b || bT)) {
              b = 0;
              bMask = 0;
            // if b is solid and node a model and a is not there or transparent or a model
            } else if (b && (!a || aT)) {
              a = 0;
              aMask = 0;
            // dont draw this face
            } else {
              a = 0;
              b = 0;
              aMask = 0;
              bMask = 0;
            }
          } else {
            a = 0;
            b = 0;
            aMask = 0;
            bMask = 0;
          }

          colors[n] = a;
          invColors[n] = b;
          mask[n] = aMask;
          invMask[n] = bMask;
        }
      }

      ++x[d];

      // Generate mesh for mask using lexicographic ordering
      function generateMesh(colors, mask, clockwise) {
        clockwise = clockwise === undefined ? true : clockwise;
        var n, j, i, c, w, h, k, du = [0,0,0], dv = [0,0,0];
        n = 0;
        for (j=0; j < dimsV; ++j) {
          for (i=0; i < dimsU; ) {
            c = colors[n];
            t = mask[n];
            if (!c) {
              i++;  n++; continue;
            }

            //Compute width
            w = 1;
            while (c === colors[n+w] && i+w < dimsU) w++;

            //Compute height (this is slightly awkward)
            for (h=1; j+h < dimsV; ++h) {
              k = 0;
              while (k < w && c === colors[n+k+h*dimsU]) k++
              if (k < w) break;
            }

            // Add quad
            // The du/dv arrays are reused/reset
            // for each iteration.
            du[d] = 0; dv[d] = 0;
            x[u]  = i;  x[v] = j;

            if (clockwise) {
            // if (c > 0) {
              dv[v] = h; dv[u] = 0;
              du[u] = w; du[v] = 0;
            } else {
              // c = -c;
              du[v] = h; du[u] = 0;
              dv[u] = w; dv[v] = 0;
            }

            // ## enable code to ensure that transparent faces are last in the list
            if (!t) {
              vertices.set(Float32Array.from([
                x[0],             x[1],             x[2],
                x[0]+du[0],       x[1]+du[1],       x[2]+du[2],
                x[0]+du[0]+dv[0], x[1]+du[1]+dv[1], x[2]+du[2]+dv[2],
                x[0]      +dv[0], x[1]      +dv[1], x[2]      +dv[2],
              ]), vertexIndex);
              vertexIndex += 3 * 4;

              faces[faceIndex++] = c;
            } else {
              tVertices.set(Float32Array.from([
                x[0],             x[1],             x[2],
                x[0]+du[0],       x[1]+du[1],       x[2]+du[2],
                x[0]+du[0]+dv[0], x[1]+du[1]+dv[1], x[2]+du[2]+dv[2],
                x[0]      +dv[0], x[1]      +dv[1], x[2]      +dv[2],
              ]), tVertexIndex);
              tVertexIndex += 3 * 4;

              tFaces[tFaceIndex++] = c;
            }

            //Zero-out mask
            W = n + w;
            for(l=0; l<h; ++l) {
              for(k=n; k<W; ++k) {
                const index = k+l*dimsU;
                colors[index] = 0;
                mask[index] = 0;
              }
            }

            //Increment counters and continue
            i += w; n += w;
          }
        }
      }
      generateMesh(colors, mask, true);
      generateMesh(invColors, invMask, false);
    }
  }

  vertices.set(tVertices.subarray(0, tVertexIndex), vertexIndex);
  faces.set(tFaces.subarray(0, tFaceIndex), faceIndex);

  return {
    vertices: vertices.subarray(0, vertexIndex + tVertexIndex),
    faces: faces.subarray(0, faceIndex + tFaceIndex),
  };
}

function getPositions(verticesData) {
  const numFaces = verticesData.length / (4 * 3);
  const result = new Float32Array(numFaces * 18);

  for (let i = 0; i < numFaces; i++) {
    const faceVertices = verticesData.subarray(i * 4 * 3, (i + 1) * 4 * 3);

    // abd
    result[i * 18 + 0] = faceVertices[0 * 3 + 0];
    result[i * 18 + 1] = faceVertices[0 * 3 + 1];
    result[i * 18 + 2] = faceVertices[0 * 3 + 2];

    result[i * 18 + 3] = faceVertices[1 * 3 + 0];
    result[i * 18 + 4] = faceVertices[1 * 3 + 1];
    result[i * 18 + 5] = faceVertices[1 * 3 + 2];

    result[i * 18 + 6] = faceVertices[3 * 3 + 0];
    result[i * 18 + 7] = faceVertices[3 * 3 + 1];
    result[i * 18 + 8] = faceVertices[3 * 3 + 2];

    // bcd
    result[i * 18 + 9] = faceVertices[1 * 3 + 0];
    result[i * 18 + 10] = faceVertices[1 * 3 + 1];
    result[i * 18 + 11] = faceVertices[1 * 3 + 2];

    result[i * 18 + 12] = faceVertices[2 * 3 + 0];
    result[i * 18 + 13] = faceVertices[2 * 3 + 1];
    result[i * 18 + 14] = faceVertices[2 * 3 + 2];

    result[i * 18 + 15] = faceVertices[3 * 3 + 0];
    result[i * 18 + 16] = faceVertices[3 * 3 + 1];
    result[i * 18 + 17] = faceVertices[3 * 3 + 2];
  }

  return result;
}

function getNormals(positions) {
  const geometry = new THREE.BufferGeometry();
  geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry.getAttribute('normal').array;
}

function getUvs(facesData, normals, {getFaceUvs}) {
  const numFaces = facesData.length;
  const result = new Float32Array(numFaces * 6 * 2);

  for (let i = 0; i < numFaces; i++) {
    const color = facesData[i];
    const normalDirection = getNormalDirection(i);
    const faceUvs = getFaceUvs(color, normalDirection);

    // abd
    result[i * 12 + 0] = faceUvs[0];
    result[i * 12 + 1] = 1 - faceUvs[1];

    result[i * 12 + 2] = faceUvs[2];
    result[i * 12 + 3] = 1 - faceUvs[1];

    result[i * 12 + 4] = faceUvs[0];
    result[i * 12 + 5] = 1 - faceUvs[3];

    // bcd
    result[i * 12 + 6] = faceUvs[2];
    result[i * 12 + 7] = 1 - faceUvs[1];

    result[i * 12 + 8] = faceUvs[2];
    result[i * 12 + 9] = 1 - faceUvs[3];

    result[i * 12 + 10] = faceUvs[0];
    result[i * 12 + 11] = 1 - faceUvs[3];
  }

  return result;

  function getNormalDirection(i) {
    const normalIndex = i * 18;
    if      (normals[normalIndex + 0] === -1) return 0;
    else if (normals[normalIndex + 0] === 1)  return 1;
    else if (normals[normalIndex + 1] === 1)  return 2;
    else if (normals[normalIndex + 1] === -1) return 3;
    else if (normals[normalIndex + 2] === -1) return 4;
    else if (normals[normalIndex + 2] === 1)  return 5;
    else                                      return 0;
  }
}

const OCCLUSIONS_MAP = {
  x: {
    true: [
      0,
      3,
      2,
      1,
    ],
    false: [
      0,
      1,
      2,
      3,
    ],
  },
  y: {
    true: [
      0,
      3,
      2,
      1,
    ],
    false: [
      0,
      1,
      2,
      3,
    ],
  },
  z: {
    true: [
      0,
      1,
      2,
      3,
    ],
    false: [
      0,
      3,
      2,
      1,
    ],
  },
};

const localVector = new THREE.Vector3();
const localVector2 = new THREE.Vector3();
const localVector3 = new THREE.Vector3();
const localVector4 = new THREE.Vector3();
const localVector5 = new THREE.Vector3();
const localCoord = new THREE.Vector2();
const localTriangle = new THREE.Triangle();
function getSsaos(verticesData, voxels) {
  const numFaces = verticesData.length / (4 * 3);
  const result = new Uint8Array(numFaces * 6);

  const _isOccluded = p => !!voxels[_getBlockIndex(p.x, p.y, p.z)];

  for (let i = 0; i < numFaces; i++) {
    const faceVertices = verticesData.subarray(i * 4 * 3, (i + 1) * 4 * 3);
    const minPoint = localVector.set(Infinity, Infinity, Infinity);

    for (let j = 0; j < 4; j++) {
      const faceVertex = localVector2.fromArray(faceVertices.subarray(j * 3, (j + 1) * 3));

      minPoint.min(faceVertex);

      if (j === 0) {
        localTriangle.a.copy(faceVertex);
      } else if (j === 1) {
        localTriangle.b.copy(faceVertex);
      } else if (j === 2) {
        localTriangle.c.copy(faceVertex);
      }
    }

    const normal = localTriangle.normal(localVector2);

    const directions = (() => {
      if (normal.x !== 0) {
        return {normal: 'x', normalSign: normal.x > 0, u: 'z', v: 'y'};
      } else if (normal.y !== 0) {
        return {normal: 'y', normalSign: normal.y > 0, u: 'x', v: 'z'};
      } else if (normal.z !== 0) {
        return {normal: 'z', normalSign: normal.z > 0, u: 'x', v: 'y'};
      } else {
        return null;
      }
    })();

// const testVector = new THREE.Vector3(5, 5, 4);

    // XXX occlusion tests need to be merged across multiple adjacent meshes

    const occlusions = Array(4);
    const occlusionsMap = OCCLUSIONS_MAP[directions.normal][directions.normalSign];
    for (let j = 0; j < 4; j++) {
      const faceVertex = localVector3.fromArray(faceVertices.subarray(j * 3, (j + 1) * 3));
      const faceVertexOffset = localVector4.copy(faceVertex).sub(minPoint);
      const faceVertexUv = localCoord.set(faceVertexOffset[directions.u], faceVertexOffset[directions.v]);

      let numOcclusions = 0;

      localVector5.copy(minPoint);
      localVector5[directions.normal] += directions.normalSign ? 0 : -1;
      localVector5[directions.u] += faceVertexUv.x === 0 ? -1 : faceVertexUv.x;
      numOcclusions += _isOccluded(localVector5);

      localVector5.copy(minPoint);
      localVector5[directions.normal] += directions.normalSign ? 0 : -1;
      localVector5[directions.v] += faceVertexUv.y === 0 ? -1 : faceVertexUv.y;
      numOcclusions += _isOccluded(localVector5);

      localVector5.copy(minPoint);
      localVector5[directions.normal] += directions.normalSign ? 0 : -1;
      localVector5[directions.u] += faceVertexUv.x === 0 ? -1 : faceVertexUv.x;
      localVector5[directions.v] += faceVertexUv.y === 0 ? -1 : faceVertexUv.y;
      numOcclusions += _isOccluded(localVector5);

// minPoint.equals(testVector) && directions.normal === 'x' && directions.normalSign && console.log('got', directions, '00', numOcclusions);

      let occlusionIndex = -1;
      if (faceVertexUv.x === 0 && faceVertexUv.y === 0) {
        occlusionIndex = 0;
      } else if (faceVertexUv.x > 0 && faceVertexUv.y === 0) {
        occlusionIndex = 1;
      } else if (faceVertexUv.x > 0 && faceVertexUv.y > 0) {
        occlusionIndex = 2;
      } else if (faceVertexUv.x === 0 && faceVertexUv.y > 0) {
        occlusionIndex = 3;
      }
      occlusions[occlusionsMap[occlusionIndex]] = numOcclusions;
    }
/* occlusions[0] = 4;
occlusions[1] = 0;
occlusions[2] = 1;
occlusions[3] = 0; */

    // abd
    result[i * 6 + 0] = occlusions[0];
    result[i * 6 + 1] = occlusions[1];
    result[i * 6 + 2] = occlusions[3];

    // bcd
    result[i * 6 + 3] = occlusions[1];
    result[i * 6 + 4] = occlusions[2];
    result[i * 6 + 5] = occlusions[3];

// minPoint.equals(testVector) && directions.normal === 'x' && directions.normalSign && console.log('result', faceVertices, occlusions);
  }

  return result;
}

const _getBlockIndex = (x, y, z) => x + y * 16 + z * 16 * 16;

return {
  tesselate,
};

};
