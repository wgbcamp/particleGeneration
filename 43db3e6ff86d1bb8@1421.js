function _reset(html){return(
html`<button>Reset`
)}

function* _elapsed(reset)
{
  reset
  let i = 0
  while (true) {
    yield i++;
  }
}

function _6(chart,elapsed)
{
  chart.update(elapsed)
  return "chart.update"
}


function _speed(Inputs){return(
Inputs.range([0.1, 7.7], {
  label: "Speed",
  step: 0.1,
  value: 0.7
})
)}

function _density(Inputs){return(
Inputs.range([1, 17], { label: "Density", step: 1, value: 6 })
)}

function _totalParticles(d3,routesAbsolute){return(
d3.sum(routesAbsolute, d => d.value)
)}

function _chart(d3,DOM,width,height,links,sankeyLinkCustom,yScale,cache,particles,totalParticles,addParticlesMaybe,psize)
{
  const svg = d3.select(DOM.svg(width, height))
    
  // Apart from aesthetic function links serve as trajectory for moving particles.
  // We'll compute particle positions in the next step
  //
  const link = svg.append("g").attr('class', 'links')
    .attr("fill", "none")
    .attr("stroke-opacity", 0.6)
    .attr("stroke", "rgb(0,156,222)")
    .selectAll("path").data(links)
    .join("path")
      // use custom sankey function here because we don't care of the node heights and link widths
      .attr('d', sankeyLinkCustom)
      .attr("stroke-width", yScale.bandwidth() + 5);  
  
      
  // Compute particle positions along the lines.
  // This technic relies on path.getPointAtLength function that returns coordinates of a point on the path
  // Another example of this technic:
  // https://observablehq.com/@oluckyman/point-on-a-path-detection
  //
  link.each(function(d) {
    const path = this
    const length = path.getTotalLength()
    const points = d3.range(length).map(l => {
      const point = path.getPointAtLength(l)
      return { x: point.x, y: point.y }
    })
    const key = `${d.source}_${d.target}`
    cache[key] = { points }
  })
  
  
  // Instead of just `return svg.node()` we do this trick.
  // It's needed to expose `update` function outside of this cell.
  // It's Observable-specific, you can see more animations technics here:
  // https://observablehq.com/@d3/learn-d3-animation?collection=@d3/learn-d3
  //
  return Object.assign(svg.node(), {
    // update will be called on each tick, so here we'll perform our animation step
    update(t) {
      if (particles.length < totalParticles) {
        addParticlesMaybe(t)
      }
      
      svg.selectAll('.particle').data(particles.filter(p => p.pos < p.length), d => d.id)
        .join(
          enter => enter.append('rect')
            .attr('class', 'particle')
            .attr('fill', d => d.color)
            .attr('width', psize)
            .attr('height', psize),
          update => update,
          exit => exit.remove()
        )
        // At this point we have `cache` with all possible coordinates.
        // We just need to figure out which exactly coordinates to use at time `t`
        //
        .each(function(d) {
          // every particle appears at its own time, so adjust the global time `t` to local time
          const localTime = t - d.createdAt
          d.pos = localTime * d.speed
          // extract current and next coordinates of the point from precomputed cache
          const index = Math.floor(d.pos) 
          const coo = cache[d.route].points[index]
          const nextCoo = cache[d.route].points[index + 1]
          if (coo && nextCoo) {
            // `index` is integer, but `pos` is not, so there are ticks when the particle is 
            // between the two precomputed points. We use `delta` to compute position between the current
            // and the next coordinates to make the animation smoother
            const delta = d.pos - index // try to set it to 0 to see how jerky the animation is
            const x = coo.x + (nextCoo.x - coo.x) * delta
            const y = coo.y + (nextCoo.y - coo.y) * delta
            d3.select(this)
              .attr('x', x)
              .attr('y', y + d.offset)
          }
      })
    }
  })
}


function _cache(){return(
{}
)}

function _particles(reset)
{ // will be populated during the chart rendering
  reset // this is Observable way to reset this cell when `reset` button is pressed
  return []
}

function _source(routes){return(
routes[2].target
)}

function _students(){return(
JSON.parse(`{  
        "bit501":     65,   
        "bit502":     240,   
        "bit503":     195,   
        "bit504":     190, 
        "bit505":     110,
        "males":		  377,
        "females":		173
}`)
)}

function _routesAbsolute(students){return(
Object.keys(students)
  .filter(key => key.startsWith('bit'))
  .map(target => ({ target, value: students[target] }))
)}

function _routes(d3,routesAbsolute)
{
  // normalize values
  const total = d3.sum(routesAbsolute, d => d.value)
  return routesAbsolute.map(r => ({ ...r, value: r.value / total }))
}

function _thresholds(d3,routes){return(
d3.range(routes.length).map(i => d3.sum(routes.slice(0, i + 1).map(r => r.value)))
)}

function _links(routes,source){return(
routes.map(({ target }) => ({ source, target }))
)}

function _addParticlesMaybe(density,routeScale,source,cache,speedScale,offsetScale,colorScale,particles){return(
(t) => {
  const particlesToAdd = Math.round(Math.random() * density)
  for (let i = 0; i < particlesToAdd; i++) {
    const target = routeScale(Math.random())
    const route = `${source}_${target}`
    const length = cache[route].points.length
    const particle = {
      // `id` is needed to distinguish the particles when some of them finish and disappear
      id: `${t}_${i}`,
      speed: speedScale(Math.random()),
      // used to position a particle vertically on the band
      offset: offsetScale(Math.random()),
      // now is used for aesthetics only, can be used to encode different types (e.g. male vs. female)
      // color: d3.interpolatePiYG(Math.random() * 0.3),
      color: colorScale(Math.random()),
      // current position on the route (will be updated in `chart.update`)
      pos: 0,
      // total length of the route, used to determine that the particle has arrived
      length,
      // when the particle is appeared
      createdAt: t,
      // route assigned to that particle
      route,
    }
    particles.push(particle)
  }
}
)}

function _sankeyLinkCustom(yScale,width){return(
({ source, target }) => {
  const curve = 0.43
  const halfH = yScale.bandwidth() / 2
  return `
    M 0,${yScale(source) + halfH}
    L ${width * curve}, ${yScale(source) + halfH}
    C ${width / 2}, ${yScale(source) + halfH}
      ${width / 2}, ${yScale(target) + halfH}
      ${width * (1 - curve)}, ${yScale(target) + halfH}
    L ${width}, ${yScale(target) + halfH}
  `
}
)}

function _yScale(d3,routes,height){return(
d3.scaleBand()
  .domain(routes.map(r => r.target))
  .range([height, 0])
  .paddingInner(0.3)
)}

function _routeScale(d3,thresholds,routes){return(
d3.scaleThreshold()
  .domain(thresholds)
  .range(routes.map(r => r.target))
)}

function _offsetScale(d3,yScale,psize){return(
d3.scaleLinear()
  .range([-yScale.bandwidth() / 2, yScale.bandwidth() / 2 - psize])
)}

function _speedScale(d3,speed){return(
d3.scaleLinear().range([speed, speed + 0.5])
)}

function _colorScale(students,d3)
{
  const total = students.males + students.females;
  const colorThresholds = [students.females / total];
  console.log(colorThresholds)
  return d3.scaleThreshold()
   .domain([0.2,0.5])
   .range(['rgb(231,172,51)', 'rgb(200,59,43)', 'rgb(109,140,49)']);
 
}

function _psize(){return(
6
)}

function _margin(){return(
{ top: 10, right: 10, bottom: 10, left: 10 }
)}

function _height(){return(
600
)}

function _css(html){return(
html`<style>

@import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap');

html {
  background-color: rgb(30,75,146);
  color: white;
  font-family: "Inter", serif;
  font-optical-sizing: auto;
  font-weight: <weight>;
  font-style: normal;
}

label {
  color: white;
}

form {
  color: black;
}

span.observablehq--string {
  opacity: 0;
}

</style>`
)}

function _d3(require){return(
require('d3@5')
)}

export default function define(runtime, observer) {
  const main = runtime.module();

  main.variable(observer("viewof reset")).define("viewof reset", ["html"], _reset);
  main.variable(observer("reset")).define("reset", ["Generators", "viewof reset"], (G, _) => G.input(_));
  main.variable(observer("elapsed")).define("elapsed", ["reset"], _elapsed);
  main.variable(observer()).define(["chart","elapsed"], _6);
  main.variable(observer("viewof speed")).define("viewof speed", ["Inputs"], _speed);
  main.variable(observer("speed")).define("speed", ["Generators", "viewof speed"], (G, _) => G.input(_));
  main.variable(observer("viewof density")).define("viewof density", ["Inputs"], _density);
  main.variable(observer("density")).define("density", ["Generators", "viewof density"], (G, _) => G.input(_));
  main.variable(observer("totalParticles")).define("totalParticles", ["d3","routesAbsolute"], _totalParticles);
  main.variable(observer("chart")).define("chart", ["d3","DOM","width","height","links","sankeyLinkCustom","yScale","cache","particles","totalParticles","addParticlesMaybe","psize"], _chart);
  main.variable(observer("cache")).define("cache", _cache);
  main.variable(observer("particles")).define("particles", ["reset"], _particles);
  main.variable(observer("source")).define("source", ["routes"], _source);
  main.variable(observer("students")).define("students", _students);
  main.variable(observer("routesAbsolute")).define("routesAbsolute", ["students"], _routesAbsolute);
  main.variable(observer("routes")).define("routes", ["d3","routesAbsolute"], _routes);
  main.variable(observer("thresholds")).define("thresholds", ["d3","routes"], _thresholds);
  main.variable(observer("links")).define("links", ["routes","source"], _links);
  main.variable(observer("addParticlesMaybe")).define("addParticlesMaybe", ["density","routeScale","source","cache","speedScale","offsetScale","colorScale","particles"], _addParticlesMaybe);
  main.variable(observer("sankeyLinkCustom")).define("sankeyLinkCustom", ["yScale","width"], _sankeyLinkCustom);
  main.variable(observer("yScale")).define("yScale", ["d3","routes","height"], _yScale);
  main.variable(observer("routeScale")).define("routeScale", ["d3","thresholds","routes"], _routeScale);
  main.variable(observer("offsetScale")).define("offsetScale", ["d3","yScale","psize"], _offsetScale);
  main.variable(observer("speedScale")).define("speedScale", ["d3","speed"], _speedScale);
  main.variable(observer("colorScale")).define("colorScale", ["students","d3"], _colorScale);
  main.variable(observer("psize")).define("psize", _psize);
  main.variable(observer("margin")).define("margin", _margin);
  main.variable(observer("height")).define("height", _height);
  main.variable(observer("css")).define("css", ["html"], _css);
  main.variable(observer("d3")).define("d3", ["require"], _d3);
  return main;
}
