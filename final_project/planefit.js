// numeric.js is used for eigenvalue computation
import * as THREE from 'three';

// Assuming points is an array of THREE.Vector3
export function fitPlane(points) {
  const n = points.length; // 8 points

  // 1. Compute centroid
  const centroid = new THREE.Vector3();
  points.forEach(p => centroid.add(p));
  centroid.divideScalar(n);

  // 2. Create covariance matrix
  let xx = 0, xy = 0, xz = 0;
  let yy = 0, yz = 0, zz = 0;

  for (let i = 0; i < n; i++) {
    const p = points[i].clone().sub(centroid);

    xx += p.x * p.x;
    xy += p.x * p.y;
    xz += p.x * p.z;
    yy += p.y * p.y;
    yz += p.y * p.z;
    zz += p.z * p.z;
  }

  const covariance = [
    [xx, xy, xz],
    [xy, yy, yz],
    [xz, yz, zz],
  ];

  // 3. Get eigenvectors of covariance matrix (you can use numeric.js or math.js)
  //    The eigenvector corresponding to the smallest eigenvalue is the normal
  const eig = numeric.eig(covariance); // numeric.js library is required

  const smallestIndex = eig.lambda.x.indexOf(Math.min(...eig.lambda.x));
  const normalArray = eig.E.x.map(row => row[smallestIndex]);
  const normal = new THREE.Vector3(...normalArray).normalize();

  return { centroid, normal }; // normal can be opposite!!
}