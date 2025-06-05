(() => {
    // Constants and data
    const INF = 1e9;
    const N = 7;
    const TRANSPARENT_REACH = 3000;
    const nodeNames = ["A", "B", "C", "D", "E", "F", "G"];
    const graph = [
      [0,    1000, INF, INF, INF, 1500, INF],
      [1000, 0,    1000, INF, INF, INF, 1500],
      [INF,  1000, 0,    1000, INF, INF, INF],
      [INF,  INF,  1000, 0,    1000, 1500, 1500],
      [INF,  INF,  INF, 1000, 0,    1800, INF],
      [1500, INF,  INF, 1500, 1800, 0,    INF],
      [INF,  1500, INF, 1500, INF, INF, 0]
    ];
  
    const svgWidth = 1000;
    const svgHeight = 420;
    const centerX = svgWidth / 2;
    const centerY = svgHeight / 2;
  
    const nodePositions = [
      {x: centerX - 300, y: centerY - 120}, // Node A
      {x: centerX - 50, y: centerY - 120},  // Node B
      {x: centerX + 200, y: centerY - 120}, // Node C
      {x: centerX + 200, y: centerY + 20},  // Node D
      {x: centerX + 80, y: centerY + 120},  // Node E
      {x: centerX - 300, y: centerY + 120}, // Node F
      {x: centerX - 80, y: centerY + 180}   // Node G
    ];
  
    const mods = [
      {name:"16QAM", capacity: 50.0, reach: 500},
      {name:"8QAM", capacity: 37.5, reach: 1000},
      {name:"QPSK", capacity: 25.0, reach: 2000},
      {name:"BPSK", capacity: 12.5, reach: 3000}
    ];
  
    // Static demand value
    const demand = 100;
  
    // Elements
    const nodeDegreesContainer = document.getElementById("node-degrees");
    const candidateRegeneratorsContainer = document.getElementById("candidate-regenerators");
    const inputError = document.getElementById("input-error");
    const numRequestsInput = document.getElementById("num-requests");
    const generateRequestsBtn = document.getElementById("generate-requests-btn");
    const requestFieldsContainer = document.getElementById("request-fields-container");
    const computeAllPathsBtn = document.getElementById("compute-all-paths-btn");
    const resultsContainer = document.getElementById("results-container");
    const resultsContent = document.getElementById("results-content");
    const svg = document.getElementById("graph-svg");
  
    // Computed data
    let degrees, regenerators;
    let shortestPathInfo;
  
    // Floyd-Warshall to get shortest paths and next matrix
    function floydWarshall(graph) {
      const dist = Array.from({length: N}, () => Array(N).fill(INF));
      const next = Array.from({length: N}, () => Array(N).fill(-1));
      for(let i=0; i<N; i++) {
        for(let j=0; j<N; j++) {
          dist[i][j] = graph[i][j];
          if(graph[i][j] < INF && i !== j) next[i][j] = j;
        }
        dist[i][i] = 0;
        next[i][i] = i;
      }
      for(let k=0; k<N; k++) {
        for(let i=0; i<N; i++) {
          for(let j=0; j<N; j++) {
            if(dist[i][k] < INF && dist[k][j] < INF) {
              if(dist[i][k] + dist[k][j] < dist[i][j]) {
                dist[i][j] = dist[i][k] + dist[k][j];
                next[i][j] = next[i][k];
              }
            }
          }
        }
      }
      return {dist, next};
    }
  
    // Reconstruct path from i to j using next matrix
    function getPath(next, i, j) {
      if(next[i][j] === -1) return [];
      let path = [i];
      while(i !== j) {
        i = next[i][j];
        if(i === -1) return [];
        path.push(i);
      }
      return path;
    }
  
    // Compute node degrees
    function computeNodeDegrees(graph) {
      let degrees = Array(N).fill(0);
      for(let i=0; i<N; i++) {
        for(let j=0; j<N; j++){
          if(graph[i][j] !== INF && i !== j) degrees[i]++;
        }
      }
      return degrees;
    }
  
    // Check if path is covered by regenerators (inter-node sums ≤ transparent reach)
    function isPathCovered(path, regenerators) {
      let acc = 0;
      for(let i=0; i+1 < path.length; i++) {
        acc += graph[path[i]][path[i+1]];
        if(acc > TRANSPARENT_REACH) {
          if(!regenerators.has(path[i]) && !regenerators.has(path[i+1])) return false;
          acc = 0;
        }
      }
      return true;
    }
  
    // Node degree first global regenerator selection
    function nodeDegreeFirstGlobal(dist, next, graph) {
      let degrees = computeNodeDegrees(graph);
      let regenerators = new Set();
      let marked = new Array(N).fill(false);
      let longPaths = [];
  
      for(let i=0; i<N; i++) {
        for(let j=0; j<N; j++) {
          if(i!==j && dist[i][j]>TRANSPARENT_REACH && dist[i][j]<INF) longPaths.push([i,j]);
        }
      }
  
      while(longPaths.length > 0) {
        let bestNode = -1, maxDegree = -1;
        for(let i=0; i<N; i++) {
          if(!marked[i] && degrees[i]>maxDegree) {
            bestNode = i; maxDegree = degrees[i];
          }
        }
        if(bestNode === -1) break;
        regenerators.add(bestNode);
        marked[bestNode] = true;
  
        let newLongPaths = [];
        for(let [i,j] of longPaths) {
          let path = getPath(next, i, j);
          if(!isPathCovered(path, regenerators)) newLongPaths.push([i,j]);
        }
        longPaths = newLongPaths;
      }
  
      return regenerators;
    }
  
    // Regenerator assignment on a specific path
    function assignRegenerators(path, regenerators) {
      let assigned = new Set();
      let acc = 0;
      
      for(let i=0; i+1 < path.length; i++) {
        acc += graph[path[i]][path[i+1]];
        
        if(acc > TRANSPARENT_REACH) {
          // Need a regenerator here
          if(regenerators.has(path[i])) {
            assigned.add(path[i]);
            acc = 0;
          } else if(regenerators.has(path[i+1])) {
            assigned.add(path[i+1]);
            acc = graph[path[i]][path[i+1]]; // Start measuring from this link
          } else {
            // Should not happen if path is covered
            console.error("Path not properly covered by regenerators");
            return new Set();
          }
        }
      }
      
      return assigned;
    }
  
    // Generate path segments based on assigned regenerators
    function getPathSegments(path, assignedRegenerators) {
      let segments = [];
      let currentSegment = [path[0]];
      
      for(let i=1; i < path.length; i++) {
        currentSegment.push(path[i]);
        
        // If this node is a regenerator and not the last node, start a new segment
        if(assignedRegenerators.has(path[i]) && i < path.length-1) {
          segments.push([...currentSegment]);
          currentSegment = [path[i]]; // Start new segment from this regenerator
        }
      }
      
      // Add the last segment if not empty
      if(currentSegment.length > 1) {
        segments.push(currentSegment);
      }
      
      return segments;
    }
  
    // Calculate distance of a path segment
    function calculateSegmentDistance(segment) {
      let distance = 0;
      for(let i=0; i < segment.length-1; i++) {
        distance += graph[segment[i]][segment[i+1]];
      }
      return distance;
    }
  
    // Select best modulation format for a segment based on distance
    function selectModulation(segmentDistance) {
      // Sort modulations by decreasing capacity (highest first)
      const sortedMods = [...mods].sort((a, b) => b.capacity - a.capacity);
      
      // Select the highest capacity modulation that can reach the required distance
      for(const mod of sortedMods) {
        if(mod.reach >= segmentDistance) {
          return mod;
        }
      }
      
      // Fallback to lowest capacity modulation if none can reach
      return sortedMods[sortedMods.length - 1];
    }
  
    // Calculate slot allocation for all segments
    function calculateSlotAllocation(segments) {
      let allAllocations = [];
      let totalSlots = 0;
      let maxConcurrentSlots = 0;
      
      for(const segment of segments) {
        const segmentDistance = calculateSegmentDistance(segment);
        const mod = selectModulation(segmentDistance);
        
        // Calculate number of slots needed based on demand and modulation capacity
        const slotsNeeded = Math.ceil(demand / mod.capacity);
        totalSlots += slotsNeeded;
        
        // For simplicity, we'll assume each new segment uses concurrent slots
        maxConcurrentSlots = Math.max(maxConcurrentSlots, slotsNeeded);
        
        // Create allocation details
        allAllocations.push({
          segment: segment.map(i => nodeNames[i]).join(" → "),
          distance: segmentDistance,
          modulation: mod.name,
          capacity: mod.capacity,
          slots: slotsNeeded
        });
      }
      
      return {allocations: allAllocations, totalSlots, maxConcurrentSlots};
    }
  
    // Initialize Graph SVG
    function initGraph() {
      svg.innerHTML = '';
      
      // Create edges first (so they're behind nodes)
      for(let i=0; i<N; i++) {
        for(let j=i+1; j<N; j++) {
          if(graph[i][j] !== INF) {
            // Create edge line
            let edge = document.createElementNS("http://www.w3.org/2000/svg", "line");
            edge.setAttribute("x1", nodePositions[i].x);
            edge.setAttribute("y1", nodePositions[i].y);
            edge.setAttribute("x2", nodePositions[j].x);
            edge.setAttribute("y2", nodePositions[j].y);
            edge.setAttribute("class", "edge");
            edge.setAttribute("data-from", i);
            edge.setAttribute("data-to", j);
            edge.setAttribute("data-distance", graph[i][j]);
            svg.appendChild(edge);
            
            // Add distance label
            let midX = (nodePositions[i].x + nodePositions[j].x) / 2;
            let midY = (nodePositions[i].y + nodePositions[j].y) / 2;
            
            // Offset the label slightly to avoid overlapping the edge
            const dx = nodePositions[j].x - nodePositions[i].x;
            const dy = nodePositions[j].y - nodePositions[i].y;
            const distance = Math.sqrt(dx*dx + dy*dy);
            
            // Increase the offset for specific connections to avoid overlapping
            let offsetMultiplier = 15; // Default offset multiplier
            
            // Special case for F to E (index 5 to 4)
            if ((i === 5 && j === 4) || (i === 4 && j === 5)) {
              offsetMultiplier = 25; // Apply larger offset for this specific edge
            }
            
            const offsetX = -dy * offsetMultiplier / distance; // Perpendicular offset
            const offsetY = dx * offsetMultiplier / distance;
            
            let edgeLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
            edgeLabel.setAttribute("x", midX + offsetX);
            edgeLabel.setAttribute("y", midY + offsetY);
            edgeLabel.setAttribute("class", "edge-label");
            edgeLabel.textContent = graph[i][j];
            
            // Add a background rectangle for better readability
            let labelBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            
            // Standard width for all distance labels
            const distWidth = 45; // Consistent width for all distance labels
            
            labelBg.setAttribute("x", midX + offsetX - distWidth/2);
            labelBg.setAttribute("y", midY + offsetY - 15);
            labelBg.setAttribute("width", distWidth);
            labelBg.setAttribute("height", 24); // Taller for better visibility
            
            // Standard styling for all edge distance labels
            labelBg.setAttribute("fill", "white");
            labelBg.setAttribute("opacity", "0.9");
            labelBg.setAttribute("rx", "5");
            labelBg.setAttribute("ry", "5");
            labelBg.setAttribute("stroke", "#ddd");
            labelBg.setAttribute("stroke-width", "1");
            edgeLabel.setAttribute("fill", "#333"); // Dark text for contrast
            edgeLabel.setAttribute("font-weight", "normal");
            edgeLabel.setAttribute("font-size", "13");
            svg.appendChild(labelBg);
            svg.appendChild(edgeLabel);
          }
        }
      }
      
      // Create nodes
      for(let i=0; i<N; i++) {
        // Create circle
        let circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", nodePositions[i].x);
        circle.setAttribute("cy", nodePositions[i].y);
        circle.setAttribute("r", 30);
        circle.setAttribute("class", "node-circle");
        circle.setAttribute("data-node", i);
        
        // Create label
        let text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", nodePositions[i].x);
        text.setAttribute("y", nodePositions[i].y);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "central");
        text.setAttribute("class", "node-label");
        text.textContent = nodeNames[i];
        
        svg.appendChild(circle);
        svg.appendChild(text);
      }
    }
  
    // Update graph based on regenerators and path
    function updateGraph(regenerators, paths = [], assignedRegs = []) {
      // Reset all nodes to default
      document.querySelectorAll(".node-circle").forEach(node => {
        node.classList.remove("candidate", "assigned", "source-dest");
      });
  
      // Reset all edges - remove all possible classes
      document.querySelectorAll(".edge").forEach(edge => {
        edge.classList.remove("highlighted", "assigned-reg");
        // Remove any path color classes
        for (let i = 0; i < 10; i++) {
          edge.classList.remove(`path-${i}`);
        }
      });
  
      // Mark candidate regenerators
      regenerators.forEach(node => {
        const circle = document.querySelector(`.node-circle[data-node="${node}"]`);
        if (circle) circle.classList.add("candidate");
      });
  
      // Process all paths and assigned regenerators
      for (let p = 0; p < paths.length; p++) {
        const path = paths[p];
        const assigned = assignedRegs[p] || new Set();
  
        // Highlight source/destination nodes
        if (path.length > 0) {
          const srcNode = document.querySelector(`.node-circle[data-node="${path[0]}"]`);
          const destNode = document.querySelector(`.node-circle[data-node="${path[path.length-1]}"]`);
          if (srcNode) srcNode.classList.add("source-dest");
          if (destNode) destNode.classList.add("source-dest");
        }
  
        // Highlight path edges with path-specific color
        for (let i = 0; i < path.length - 1; i++) {
          const edge = document.querySelector(`.edge[data-from="${Math.min(path[i], path[i+1])}"][data-to="${Math.max(path[i], path[i+1])}"]`);
          if (edge) {
            // If this edge connects to an assigned regenerator, add assigned-reg class
            if (assigned.has(path[i]) || assigned.has(path[i+1])) {
              edge.classList.add("assigned-reg");
            } 
            
            // Add path-specific color class (path-0, path-1, etc.)
            edge.classList.add(`path-${p % 10}`);
          }
        }
  
        // Mark assigned regenerators
        assigned.forEach(node => {
          const circle = document.querySelector(`.node-circle[data-node="${node}"]`);
          if (circle) {
            circle.classList.remove("candidate");
            circle.classList.add("assigned");
          }
        });
      }
    }
  
    // Initialize node degrees display
    function initNodeDegrees() {
      nodeDegreesContainer.innerHTML = '';
      degrees = computeNodeDegrees(graph);
      
      for(let i=0; i<N; i++) {
        let badge = document.createElement("div");
        badge.className = "node-badge";
        badge.textContent = `${nodeNames[i]}: ${degrees[i]}`;
        nodeDegreesContainer.appendChild(badge);
      }
    }
  
    // Initialize candidate regenerators display
    function initCandidateRegenerators() {
      candidateRegeneratorsContainer.innerHTML = '';
      shortestPathInfo = floydWarshall(graph);
      regenerators = nodeDegreeFirstGlobal(shortestPathInfo.dist, shortestPathInfo.next, graph);
      
      for(let node of regenerators) {
        let badge = document.createElement("div");
        badge.className = "node-badge regenerator";
        badge.textContent = nodeNames[node];
        candidateRegeneratorsContainer.appendChild(badge);
      }
    }
  
    // Generate request fields based on number of requests
    function generateRequestFields() {
      requestFieldsContainer.innerHTML = '';
      
      // Check if the input is empty
      if (!numRequestsInput.value) {
        inputError.textContent = 'Please enter the number of connection requests';
        return;
      }
      
      const numRequests = parseInt(numRequestsInput.value);
      inputError.textContent = ''; // Clear any previous error
      
      for(let i=0; i<numRequests; i++) {
        const requestField = document.createElement("div");
        requestField.className = "request-field";
        requestField.innerHTML = `
          <h3>Request ${i+1}</h3>
          <label for="src-node-${i}">Enter source:</label>
          <select id="src-node-${i}" class="src-node" data-request="${i}"></select>
          
          <label for="dest-node-${i}">Enter destination:</label>
          <select id="dest-node-${i}" class="dest-node" data-request="${i}"></select>
        `;
        requestFieldsContainer.appendChild(requestField);
        
        // Populate select options
        const srcSelect = document.getElementById(`src-node-${i}`);
        const destSelect = document.getElementById(`dest-node-${i}`);
        
        for(let j=0; j<N; j++) {
          let srcOption = document.createElement("option");
          srcOption.value = j;
          srcOption.textContent = nodeNames[j];
          srcSelect.appendChild(srcOption);
          
          let destOption = document.createElement("option");
          destOption.value = j;
          destOption.textContent = nodeNames[j];
          destSelect.appendChild(destOption);
        }
        
        // Don't set default values - let the user choose
        // Clear the selection by default
        srcSelect.selectedIndex = -1;
        destSelect.selectedIndex = -1;
        
        // Add a disabled default option
        let srcDefaultOption = document.createElement("option");
        srcDefaultOption.value = "";
        srcDefaultOption.textContent = "Select source";
        srcDefaultOption.disabled = true;
        srcDefaultOption.selected = true;
        srcSelect.insertBefore(srcDefaultOption, srcSelect.firstChild);
        
        let destDefaultOption = document.createElement("option");
        destDefaultOption.value = "";
        destDefaultOption.textContent = "Select destination";
        destDefaultOption.disabled = true;
        destDefaultOption.selected = true;
        destSelect.insertBefore(destDefaultOption, destSelect.firstChild);
      }
      
      // Show compute button
      computeAllPathsBtn.style.display = "block";
    }
  
    // Validate all input fields
    function validateInputs() {
      const srcSelects = document.querySelectorAll('.src-node');
      const destSelects = document.querySelectorAll('.dest-node');
      let isValid = true;
      
      for(let i=0; i<srcSelects.length; i++) {
        // Check if source or destination is not selected
        if(srcSelects[i].selectedIndex <= 0) {
          inputError.textContent = `Request ${i+1}: Please select a source node`;
          isValid = false;
          break;
        }
        
        if(destSelects[i].selectedIndex <= 0) {
          inputError.textContent = `Request ${i+1}: Please select a destination node`;
          isValid = false;
          break;
        }
        
        const src = parseInt(srcSelects[i].value);
        const dest = parseInt(destSelects[i].value);
        
        if(src === dest) {
          inputError.textContent = `Request ${i+1}: Source and destination cannot be the same`;
          isValid = false;
          break;
        }
        
        if(shortestPathInfo.dist[src][dest] === INF) {
          inputError.textContent = `Request ${i+1}: No path exists between ${nodeNames[src]} and ${nodeNames[dest]}`;
          isValid = false;
          break;
        }
      }
      
      if(isValid) {
        inputError.textContent = '';
      }
      
      return isValid;
    }
  
    // Create a mini graph visualization for an individual path
    function createPathGraph(path, assignedRegs, pathColorIndex) {
      const pathGraph = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      pathGraph.setAttribute("class", "result-graph-svg");
      pathGraph.setAttribute("viewBox", "0 0 1200 600"); // Wider viewBox for more spacious layout
      
      // Get the path color with higher vibrancy
      const pathColors = [
        '#2980b9', // Stronger blue
        '#c0392b', // Stronger red
        '#8e44ad', // Stronger purple
        '#d35400', // Stronger orange
        '#27ae60', // Stronger green
        '#16a085', // Stronger teal
        '#f39c12', // Stronger yellow
        '#6c3483', // Stronger violet
        '#1abc9c', // Stronger turquoise
        '#2c3e50'  // Stronger navy
      ];
      const pathColor = pathColors[pathColorIndex % 10];
      
      // Calculate a more spacious layout for the result graph
      const resultNodePositions = [];
      const centerX = 600; // Center of wider viewBox
      const centerY = 300;
      const radius = 200;  // Larger radius for more spacing
      
      // Position nodes in a more spacious circular layout
      for (let i = 0; i < N; i++) {
        const angle = (i * 2 * Math.PI / N) - Math.PI/2; // Start from top
        resultNodePositions.push({
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle)
        });
      }
      
      // Create edges first (so they're behind nodes)
      for(let i=0; i<N; i++) {
        for(let j=i+1; j<N; j++) {
          if(graph[i][j] !== INF) {
            // Create edge line
            let edge = document.createElementNS("http://www.w3.org/2000/svg", "line");
            edge.setAttribute("x1", resultNodePositions[i].x);
            edge.setAttribute("y1", resultNodePositions[i].y);
            edge.setAttribute("x2", resultNodePositions[j].x);
            edge.setAttribute("y2", resultNodePositions[j].y);
            
            // Check if this edge is part of the path
            let isPathEdge = false;
            for (let p = 0; p < path.length - 1; p++) {
              if ((path[p] === i && path[p + 1] === j) || (path[p] === j && path[p + 1] === i)) {
                isPathEdge = true;
                break;
              }
            }
            
            if (isPathEdge) {
              // Path edge styling - bold red to match source/dest nodes
              edge.setAttribute("stroke", "#e74c3c"); // Red like source/dest nodes
              edge.setAttribute("stroke-width", "4"); // Thicker line like reference
              edge.setAttribute("stroke-linecap", "round");
            } else {
              // Non-path edge styling - light gray dashed like in reference
              edge.setAttribute("stroke", "#ccc"); // Light gray like reference
              edge.setAttribute("stroke-width", "1.5");
              edge.setAttribute("stroke-dasharray", "5,3"); // Dashed like reference
            }
            
            pathGraph.appendChild(edge);
            
            // Add distance label for all edges
            const midX = (resultNodePositions[i].x + resultNodePositions[j].x) / 2;
            const midY = (resultNodePositions[i].y + resultNodePositions[j].y) / 2;
            
            // Create a background for the distance label
            // Adjust background size based on the distance value (larger for 4-digit numbers)
            const distanceValue = graph[i][j];
            const isLargeNumber = distanceValue >= 1000;
            const bgWidth = isLargeNumber ? 60 : 40;
            
            const labelBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            labelBg.setAttribute("x", midX - bgWidth/2);
            labelBg.setAttribute("y", midY - 15);
            labelBg.setAttribute("width", bgWidth);
            labelBg.setAttribute("height", 25); // Slightly taller
            labelBg.setAttribute("fill", "white");
            
            // Distance label styling based on reference image
            labelBg.setAttribute("opacity", "1");
            labelBg.setAttribute("stroke", "#bbb");
            labelBg.setAttribute("stroke-width", "1");
            labelBg.setAttribute("rx", "4"); // Slightly rounded corners like reference
            pathGraph.appendChild(labelBg);
            
            // Create the distance label
            const distLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
            distLabel.setAttribute("x", midX);
            distLabel.setAttribute("y", midY);
            distLabel.setAttribute("text-anchor", "middle");
            distLabel.setAttribute("dominant-baseline", "central");
            
            // Set text color based on if it's a path edge
            if (isPathEdge) {
              distLabel.setAttribute("fill", "#000");
              distLabel.setAttribute("font-weight", "bold");
            } else {
              distLabel.setAttribute("fill", "#666");
              distLabel.setAttribute("font-weight", "normal");
            }
            
            distLabel.setAttribute("font-size", isLargeNumber ? "15" : "13"); // Larger font for 4-digit numbers
            distLabel.textContent = distanceValue;
            pathGraph.appendChild(distLabel);
          }
        }
      }
      
      // Create nodes
      for(let i=0; i<N; i++) {
        // Create circle
        let circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", resultNodePositions[i].x);
        circle.setAttribute("cy", resultNodePositions[i].y);
        circle.setAttribute("r", 35); // Larger nodes
        
        // Set node styling based on its role to match reference image
        if (path.indexOf(i) === 0 || path.indexOf(i) === path.length - 1) {
          // Source or destination node - bright red like in the reference image
          circle.setAttribute("fill", "#e74c3c"); // Red for source/dest
          circle.setAttribute("stroke", "#c0392b");
          circle.setAttribute("stroke-width", "3");
          circle.setAttribute("filter", "drop-shadow(0 0 3px rgba(231,76,60,0.4))");
        } else if (assignedRegs.has(i)) {
          // Assigned regenerator node - green from the reference
          circle.setAttribute("fill", "#27ae60"); // Green like reference
          circle.setAttribute("stroke", "#219955");
          circle.setAttribute("stroke-width", "3");
          circle.setAttribute("filter", "drop-shadow(0 0 3px rgba(39,174,96,0.4))");
        } else if (regenerators.has(i) && path.indexOf(i) > 0) {
          // Candidate regenerator that's also on the path
          circle.setAttribute("fill", "#f39c12"); // Orange like reference
          circle.setAttribute("stroke", "#d68910");
          circle.setAttribute("stroke-width", "3");
          circle.setAttribute("filter", "drop-shadow(0 0 3px rgba(243,156,18,0.4))");
        } else if (path.indexOf(i) > 0) {
          // Regular node on the path - also red to match source/dest
          circle.setAttribute("fill", "#e74c3c"); // Red like source/dest
          circle.setAttribute("stroke", "#c0392b");
          circle.setAttribute("stroke-width", "3");
        } else {
          // Non-path node - light gray like reference image
          circle.setAttribute("fill", "#ecf0f1"); // Light gray from reference
          circle.setAttribute("stroke", "#bdc3c7");
          circle.setAttribute("stroke-width", "1");
        }
        
        // Create label
        let text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", resultNodePositions[i].x);
        text.setAttribute("y", resultNodePositions[i].y);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "central");
        text.setAttribute("fill", "#fff");
        text.setAttribute("font-weight", "bold");
        text.setAttribute("font-size", "16");
        text.setAttribute("pointer-events", "none");
        text.textContent = nodeNames[i];
        
        pathGraph.appendChild(circle);
        pathGraph.appendChild(text);
      }
      
      return pathGraph;
    }
    
    // Compute paths for all requests
    function computeAllPaths() {
      if(!validateInputs()) return;
      
      // Clear previous results
      resultsContainer.style.display = "block";
      resultsContent.innerHTML = '';
      
      // Show reset button after computing paths
      document.getElementById('reset-btn-container').style.display = 'block';
      
      const srcSelects = document.querySelectorAll('.src-node');
      const destSelects = document.querySelectorAll('.dest-node');
      
      let allPaths = [];
      let allAssignedRegenerators = [];
      
      // Process each request
      for(let i=0; i<srcSelects.length; i++) {
        const src = parseInt(srcSelects[i].value);
        const dest = parseInt(destSelects[i].value);
        
        // Get path for this request
        const path = getPath(shortestPathInfo.next, src, dest);
        allPaths.push(path);
        
        // Assign regenerators for this path
        const assignedRegs = assignRegenerators(path, regenerators);
        allAssignedRegenerators.push(assignedRegs);
        
        // Get path segments
        const segments = getPathSegments(path, assignedRegs);
        
        // Calculate slot allocation
        const slotAllocation = calculateSlotAllocation(segments);
        
        // Create result container for this request
        const requestResult = document.createElement("div");
        requestResult.className = "results-request";
        
        // Display path
        const pathDisplay = document.createElement("div");
        pathDisplay.className = "path-nodes";
        pathDisplay.innerHTML = `
          <strong>Path:</strong> ${path.map(n => nodeNames[n]).join(" → ")}
        `;
        
        // Display assigned regenerators
        const regsDisplay = document.createElement("div");
        regsDisplay.innerHTML = `<strong>Assigned Regenerators:</strong> `;
        
        if(assignedRegs.size === 0) {
          regsDisplay.innerHTML += "None (transparent reach sufficient)";
        } else {
          const regsContainer = document.createElement("div");
          regsContainer.className = "compact-list";
          
          assignedRegs.forEach(node => {
            const badge = document.createElement("div");
            badge.className = "node-badge assigned";
            badge.textContent = nodeNames[node];
            regsContainer.appendChild(badge);
          });
          
          regsDisplay.appendChild(regsContainer);
        }
        
        // Display slot allocation details
        const slotDisplay = document.createElement("div");
        slotDisplay.innerHTML = `
          <h3>Frequency Slot Allocation <span class="demand-info">(Demand: ${demand} Gbps)</span></h3>
          <div class="segments-container">
            ${slotAllocation.allocations.map(alloc => `
              <div><strong>Segment:</strong> ${alloc.segment}</div>
              <div><strong>Distance:</strong> ${alloc.distance} km</div>
              <div><strong>Modulation:</strong> ${alloc.modulation} (Capacity: ${alloc.capacity} Gbps)</div>
              <div><strong>Slots Needed:</strong> ${alloc.slots}</div>
              <hr style="margin: 10px 0; border: 0; border-top: 1px dashed #ccc;">
            `).join('')}
          </div>
          <table class="slot-table">
            <thead>
              <tr>
                <th>Total Slots Assigned</th>
                <th>Max Concurrent Slots (Spectrum Footprint)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${slotAllocation.totalSlots}</td>
                <td>${slotAllocation.maxConcurrentSlots}</td>
              </tr>
            </tbody>
          </table>
        `;
        
        // Define path colors array - using the same vibrant colors as in createPathGraph
        const pathColors = [
          '#2980b9', // Stronger blue
          '#c0392b', // Stronger red
          '#8e44ad', // Stronger purple
          '#d35400', // Stronger orange
          '#27ae60', // Stronger green
          '#16a085', // Stronger teal
          '#f39c12', // Stronger yellow
          '#6c3483', // Stronger violet
          '#1abc9c', // Stronger turquoise
          '#2c3e50'  // Stronger navy
        ];
        
        // Set the border color of the result container to red to match path color
        requestResult.style.borderLeftColor = "#e74c3c"; // Red like source/dest nodes
        
        // Assemble the request result with color indicator and demand
        requestResult.innerHTML = `<h3>
          <span class="path-color-indicator" style="background-color: #e74c3c"></span>
          Request ${i+1}: ${nodeNames[src]} to ${nodeNames[dest]} <span class="demand-info">(${demand} Gbps)</span>
        </h3>`;
        
        // Add individual path visualization for this request
        const pathVisualization = document.createElement("div");
        pathVisualization.className = "path-visualization";
        const pathGraph = createPathGraph(path, assignedRegs, i);
        pathVisualization.appendChild(pathGraph);
        
        requestResult.appendChild(pathVisualization);
        requestResult.appendChild(pathDisplay);
        requestResult.appendChild(regsDisplay);
        requestResult.appendChild(slotDisplay);
        
        resultsContent.appendChild(requestResult);
      }
      
      // Don't update the main graph
      // Keep the main graph showing only the network topology and candidate regenerators
    }
  
    // Function to reset the application state
    function resetApplication() {
      // Clear results
      resultsContainer.style.display = "none";
      resultsContent.innerHTML = '';
      
      // Reset request fields container and hide compute button
      requestFieldsContainer.innerHTML = '';
      computeAllPathsBtn.style.display = "none";
      
      // Reset input field
      numRequestsInput.value = '';
      inputError.textContent = '';
      
      // Hide reset button
      document.getElementById('reset-btn-container').style.display = 'none';
      
      // Reset the graph to initial state
      updateGraph(regenerators);
      
      // Scroll back to top
      window.scrollTo(0, 0);
    }
    
    // Initialize everything
    function init() {
      initNodeDegrees();
      initCandidateRegenerators();
      initGraph();
      updateGraph(regenerators);
      
      // Create reset button container at bottom right (footer)
      const resetBtnContainer = document.createElement("div");
      resetBtnContainer.id = "reset-btn-container";
      resultsContainer.appendChild(resetBtnContainer);
      
      // Add reset button
      const resetBtn = document.createElement("button");
      resetBtn.id = "reset-btn";
      resetBtn.className = "action-button";
      resetBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v6h6"></path><path d="M3 13a9 9 0 1 0 3-7.7L3 8"></path></svg> Reset`;
      resetBtn.addEventListener('click', resetApplication);
      
      resetBtnContainer.appendChild(resetBtn);
      
      // Event listeners
      generateRequestsBtn.addEventListener('click', generateRequestFields);
      computeAllPathsBtn.addEventListener('click', computeAllPaths);
      
      // Generate initial request field
      generateRequestFields();
    }
  
    // Start the application
    init();
  })();
  
