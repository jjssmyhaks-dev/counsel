const h = require('http');
h.get('http://127.0.0.1:3000/product', function(r) {
  let d = '';
  r.on('data', function(c) { d += c; });
  r.on('end', function() {
    const checks = ['Clause Extraction', 'Playbook', 'Meeting Intelligence', 'Audit Trail', 'Force Majeure',
      'violation', 'Patent portfolio', 'SHA-256', 'action items', 'Indemnification Cap'];
    checks.forEach(function(p) {
      console.log(p, ': ', d.indexOf(p) > -1 ? 'FOUND' : 'MISSING');
    });
    console.log('SIZE_KB', Math.round(d.length / 1024));
  });
});
