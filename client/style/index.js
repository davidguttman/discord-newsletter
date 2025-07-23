const insert = require('insert-css')

require('./tachyons')
require('./loaders')

insert(`
  body {
    background: #1c1c1c;
    color: #f8f9fa;
  }

  .ball-scale-ripple-multiple > div {
    border-color: #ff41b4;
    border-radius: 0;
    transform: scale(3);
  }
  
  /* Override tachyons colors for better dark theme contrast */
  .black { color: #f8f9fa !important; }
  .near-black { color: #e9ecef !important; }
  .dark-gray { color: #dee2e6 !important; }
  .mid-gray { color: #adb5bd !important; }
  .gray { color: #6c757d !important; }
  .silver { color: #495057 !important; }
  .light-silver { color: #343a40 !important; }
  .moon-gray { color: #212529 !important; }
  .light-gray { color: #1a1a1a !important; }
  .near-white { color: #1c1c1c !important; }
  .white { color: #000 !important; }
`)
