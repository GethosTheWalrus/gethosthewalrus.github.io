// svg-pan-zoom loader for all SVGs
(function(){
  let panZoomInstances = [];
  
  function loadScript(url, callback){
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.onload = callback;
    script.src = url;
    document.head.appendChild(script);
  }

  function enablePanZoomOnSVGs() {
    console.log('Checking for SVGs to enable pan/zoom...');
    
    // Find all zero-md elements
    document.querySelectorAll('zero-md').forEach(function(zeroMd) {
      // Access the shadow root
      const shadow = zeroMd.shadowRoot;
      if (shadow) {
        console.log('Found zero-md shadow root');
        // Find all SVGs inside the shadow root
        const svgs = shadow.querySelectorAll('svg');
        console.log('Found', svgs.length, 'SVGs in shadow root');
        
        svgs.forEach(function(svg) {
          if (!svg._panZoomAttached && window.svgPanZoom) {
            console.log('Processing SVG for pan/zoom');
            
            // Get the SVG's natural dimensions
            const bbox = svg.getBBox();
            const viewBox = svg.viewBox?.baseVal;
            
            console.log('SVG bbox:', bbox);
            console.log('SVG viewBox:', viewBox);
            
            // Remove existing width/height attributes
            svg.removeAttribute('width');
            svg.removeAttribute('height');
            
            // Set up container styles
            const container = svg.parentElement;
            if (container) {
              container.style.width = '100%';
              container.style.height = '70vh';
              container.style.overflow = 'hidden';
              container.style.position = 'relative';
              container.style.display = 'block';
              container.style.margin = '20px auto';
              container.style.cursor = 'grab';
              container.style.userSelect = 'none';
              container.style.borderRadius = '8px';
              container.style.backgroundColor = '#f8f9fa';
            }
            
            // Set SVG to fill container
            svg.style.width = '100%';
            svg.style.height = '100%';
            svg.style.display = 'block';
            svg.style.cursor = 'grab';
            svg.style.userSelect = 'none';
            svg.style.pointerEvents = 'all';
            
            // Initialize svg-pan-zoom
            try {
              const panZoomInstance = window.svgPanZoom(svg, {
                zoomEnabled: true,
                controlIconsEnabled: true,
                fit: true,
                center: true,
                minZoom: 0.1,
                maxZoom: 20,
                zoomScaleSensitivity: 0.2,
                dblClickZoomEnabled: true,
                mouseWheelZoomEnabled: true,
                preventMouseEventsDefault: true,
                eventsListenerElement: null,
                onPan: function() {
                  svg.style.cursor = 'grabbing';
                },
                onZoom: function() {
                  svg.style.cursor = 'grab';
                }
              });
              
              // Prevent page scrolling when wheel is used over the SVG container
              const preventPageScroll = function(evt) {
                if (evt.type === 'wheel') {
                  // Check if the event target is within our SVG container
                  const rect = container.getBoundingClientRect();
                  const isInContainer = evt.clientX >= rect.left && 
                                      evt.clientX <= rect.right && 
                                      evt.clientY >= rect.top && 
                                      evt.clientY <= rect.bottom;
                  
                  if (isInContainer) {
                    evt.preventDefault();
                    evt.stopPropagation();
                    return false;
                  }
                }
              };
              
              // Add wheel event listener to document to catch all wheel events
              document.addEventListener('wheel', preventPageScroll, { passive: false });
              
              // Store the listener so we can clean it up if needed
              svg._wheelListener = preventPageScroll;
              
              panZoomInstances.push(panZoomInstance);
              svg._panZoomAttached = true;
              console.log('Successfully attached svg-pan-zoom to SVG');
              
            } catch (error) {
              console.error('Error initializing svg-pan-zoom:', error);
            }
          }
        });
      }
    });
  }

  // Multiple event listeners to catch when content is ready
  document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, waiting for zero-md...');
    setTimeout(enablePanZoomOnSVGs, 1000);
  });

  document.addEventListener('zero-md-rendered', function() {
    console.log('zero-md rendered event fired');
    setTimeout(enablePanZoomOnSVGs, 100);
  });

  // Load svg-pan-zoom from CDN
  loadScript('https://cdn.jsdelivr.net/npm/svg-pan-zoom@3.6.1/dist/svg-pan-zoom.min.js', function() {
    console.log('svg-pan-zoom library loaded');
    // Try multiple times to catch SVGs that might load later
    setTimeout(enablePanZoomOnSVGs, 500);
    setTimeout(enablePanZoomOnSVGs, 1500);
    setTimeout(enablePanZoomOnSVGs, 3000);
  });

  // Also try when page is fully loaded
  window.addEventListener('load', function() {
    setTimeout(enablePanZoomOnSVGs, 1000);
  });
})();
