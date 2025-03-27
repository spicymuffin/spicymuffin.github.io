function quadeq_solve(a, b, c) {
  var discriminant = b * b - 4 * a * c;
  var x1 = (-b + Math.sqrt(discriminant)) / (2 * a);
  var x2 = (-b - Math.sqrt(discriminant)) / (2 * a);
  return [x1, x2];
}

function quadeq_n_roots(a, b, c) {
  var discriminant = b * b - 4 * a * c;
  if (discriminant > 0) {
    return 2;
  } else if (discriminant == 0) {
    return 1;
  } else {
    return 0;
  }
}
