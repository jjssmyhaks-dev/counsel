const h = require('http');
h.get('http://127.0.0.1:3000/matters', function(r) {
  let d = '';
  r.on('data', function(c) { d += c; });
  r.on('end', function() {
    // Check for old color patterns still present
    const oldPatterns = {
      'bg-slate-': (d.match(/bg-slate-/g) || []).length,
      'text-slate-': (d.match(/text-slate-/g) || []).length,
      'border-slate-': (d.match(/border-slate-/g) || []).length,
      'bg-white ': (d.match(/bg-white /g) || []).length,
      'bg-blue-': (d.match(/bg-blue-/g) || []).length,
      'rounded-xl': (d.match(/rounded-xl/g) || []).length,
      'rounded-2xl': (d.match(/rounded-2xl/g) || []).length,
      'shadow-sm': (d.match(/shadow-sm/g) || []).length,
    };
    const newPatterns = {
      'green_brand': (d.match(/15b881|0a8a5f|7ce3b6/g) || []).length,
      'near_black': (d.match(/0c0a09/g) || []).length,
      'font_serif': (d.match(/font-serif/g) || []).length,
      'warm_bg': (d.match(/fefdfb/g) || []).length,
    };
    console.log('OLD PATTERNS:', JSON.stringify(oldPatterns));
    console.log('NEW PATTERNS:', JSON.stringify(newPatterns));
    console.log('SIZE_KB', Math.round(d.length / 1024));
  });
});
