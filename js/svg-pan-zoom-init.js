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
  
  function shouldExclude(svg) {
    // Check if any ancestor element has the 'no-panzoom' class
    let element = svg;
    let depth = 0;
    while (element) {
      console.log(`Checking ancestor ${depth}:`, element.tagName, element.className);
      if (element.classList && element.classList.contains('no-panzoom')) {
        console.log('Found no-panzoom class - excluding this SVG');
        return true;
      }
      element = element.parentElement;
      depth++;
      if (depth > 10) break; // Safety limit
    }
    console.log('No no-panzoom class found in ancestors');
    return false;
  }

  function setupMermaidSVG(svg, container) {
    if (!container || !svg) return;
    
    // For Mermaid, preserve viewBox dimensions
    const vb = svg.viewBox?.baseVal;
    if (vb) {
      svg.setAttribute('width', vb.width);
      svg.setAttribute('height', vb.height);
    }
    
    // Container: allow height to grow naturally from the SVG's intrinsic size
    container.style.width = '100%';
    container.style.height = '';
    container.style.overflow = 'visible';
    container.style.margin = '20px auto';
    container.style.cursor = 'grab';
    container.style.userSelect = 'none';
    container.style.backgroundColor = 'transparent';
    container.style.borderRadius = '0';
    container.style.border = 'none';
    
    // SVG styling
    svg.style.width = '100%';
    svg.style.height = 'auto';
    svg.style.display = 'block';
    svg.style.cursor = 'grab';
    svg.style.userSelect = 'none';
    svg.style.backgroundColor = 'transparent';
  }

  function setupOtherSVG(svg, container) {
    if (!container || !svg) return;
    
    // Remove intrinsic dimensions for other SVGs so container sizing works
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    
    container.style.width = '100%';
    container.style.height = '70vh';
    container.style.overflow = 'hidden';
    container.style.margin = '20px auto';
    container.style.cursor = 'grab';
    container.style.userSelect = 'none';
    container.style.borderRadius = '8px';
    container.style.backgroundColor = '#f8f9fa';
    
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.display = 'block';
    svg.style.cursor = 'grab';
    svg.style.userSelect = 'none';
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
            
            const bbox = svg.getBBox();
            const viewBox = svg.viewBox?.baseVal;
            const svgParent = svg.parentElement;
            const isMermaid = svgParent && svgParent.classList.contains('mermaid');
            const isExcluded = shouldExclude(svg);
            
            console.log('SVG bbox:', bbox);
            console.log('SVG viewBox:', viewBox);
            console.log('isMermaid:', isMermaid);
            console.log('isExcluded:', isExcluded);
            
            const container = svg.parentElement;
            
            if (isExcluded) {
              console.log('Skipping pan/zoom for excluded SVG - applying static styles');
              // Just set basic display styles, no pan/zoom
              if (isMermaid) {
                // Mermaid diagrams need viewBox dimensions
                const vb = svg.viewBox?.baseVal;
                if (vb) {
                  svg.setAttribute('width', vb.width);
                  svg.setAttribute('height', vb.height);
                }
                svg.style.width = '100%';
                svg.style.height = 'auto';
                svg.style.display = 'block';
                svg.style.cursor = 'default';
                svg.style.position = '';
                svg.style.top = '';
                svg.style.left = '';
                
                if (container) {
                  container.style.position = '';
                  container.style.width = '100%';
                  container.style.overflow = 'visible';
                  container.style.margin = '20px auto';
                  container.style.backgroundColor = 'transparent';
                  container.style.borderRadius = '0';
                }
              } else {
                svg.style.cursor = 'default';
                svg.style.width = '100%';
                svg.style.height = 'auto';
                svg.style.display = 'block';
                svg.style.position = '';
                svg.style.top = '';
                svg.style.left = '';
                
                if (container) {
                  container.style.position = '';
                  container.style.width = '100%';
                  container.style.overflow = 'visible';
                  container.style.margin = '20px auto';
                  container.style.height = '';
                  container.style.backgroundColor = 'transparent';
                  container.style.borderRadius = '0';
                }
              }
              
              svg._panZoomAttached = true;
            } else if (isMermaid) {
              console.log('Setting up mermaid SVG');
              setupMermaidSVG(svg, container);
            } else {
              console.log('Setting up other SVG');
              setupOtherSVG(svg, container);
            }
            
            // Only initialize svg-pan-zoom for non-excluded SVGs
            if (!isExcluded) {
              try {
                console.log('Initializing svg-pan-zoom');
                const panZoomInstance = window.svgPanZoom(svg, {
                  zoomEnabled: true,
                  controlIconsEnabled: true,
                  fit: isMermaid ? false : true,
                  center: isMermaid ? false : true,
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
                    if (container && container.getBoundingClientRect) {
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
                  }
                };
                
                // Add wheel event listener to document to catch all wheel events
                document.addEventListener('wheel', preventPageScroll, { passive: false });
                
                panZoomInstances.push(panZoomInstance);
                svg._panZoomAttached = true;
                svg._wheelListener = preventPageScroll;
                console.log('Successfully attached svg-pan-zoom to SVG');
              } catch (error) {
                console.error('Error initializing svg-pan-zoom:', error);
              }
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
