d3.queue()
    .defer(d3.csv,'processed/total_global_co_2.csv')
    .defer(d3.csv,'processed/methane.csv')
    .await(function(error, co2, methane) {

        var tip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);

        var margins = {top: 25, right: 25, bottom: 50, left: 40},
            height = 300 - margins.top - margins.bottom,
            bar_width = 300,
            parse_year = d3.timeParse("%Y"),
            num_format = d3.format(",");

        var colors = ['#67001f','#b2182b','#d6604d','#f4a582','#fddbc7','#f7f7f7','#d1e5f0','#92c5de','#4393c3','#2166ac','#053061'].reverse();
        var strip_color = d3.scaleQuantize()
            .domain(d3.extent(methane, d3.f('mean')))
            .range(colors);
        var width = 400 - margins.right - margins.left;

        co2.forEach(function(d) {
            d.date = parse_year(d.year);
            d.total = +d.total;
            d.gas_fuel = +d.gas_fuel;
            d.liquid_fuel = +d.liquid_fuel;
            d.solid_fuel = +d.solid_fuel;
            d.cement_production = +d.cement_production;
            d.gas_flaring = +d.gas_flaring;
        });

        methane.forEach(function(d) {
            d.date = parse_year(d.year);
            d.mean = +d.mean;
        });

        /* Bisect data */
        var bisectDate = d3.bisector(function(d) { return d.date; }).right;

        var fields = ['solid_fuel','liquid_fuel','gas_fuel','cement_production','gas_flaring'];
        var stack = d3.stack()
            .keys(fields)
            .order(d3.stackOrderNone)
            .offset(d3.stackOffsetWiggle);

        var series = stack(co2);

        fields.forEach(function(field_name, i) {
            var title = field_name.split("_");

            d3.select("#co-two").append("div")
                .attr("class", "graph")
                .attr("id", "graphed" + i);

            d3.select("#graphed" + i)
                .append("h4")
                .attr("class", "text-center text-top")
                .text(_.capitalize(title[0]) + ' ' + _.capitalize(title[1]));

            drawGraph("#graphed" + i, field_name, i);
        });

        var methaneScale = d3.scaleTime()
            .range([0, bar_width]);
        methaneScale.domain(d3.extent(methane, d3.f('date')));

        drawStrip("#methane", methane);

        function drawGraph(selector, field, i) {
            var data = (isNaN(i)) ? methane : co2;
            var svg = d3.select(selector).append("svg");

            svg.attr("height", height + margins.top + margins.bottom)
                .attr("width", width + margins.right + margins.left)
                .attr("class", "carbon-dioxide")
                .attr("id", "graph_" + i);

            var xScale = d3.scaleTime()
                .range([0, width]);
            xScale.domain(d3.extent(data, d3.f('date')));

            var yScale =  d3.scaleSqrt()
                .range([0, height]);
            yScale.domain([4150, 0]);

            var xAxis = d3.axisBottom()
                .scale(xScale);

            var yAxis = d3.axisLeft()
                .scale(yScale);

            svg.append("g")
                .attr("class", "axis x_" + i)
                .translate([margins.left, height + margins.top]);

            d3.select("g.x_" + i).call(xAxis);

            svg.append("g")
                .attr("class", "axis y_" + i)
                .translate([margins.left, margins.top]);

            d3.select("g.y_" + i).call(yAxis);

            var co2_line =  d3.line()
                .curve(d3.curveNatural)
                .x(function(d) { return xScale(d.date); })
                .y(function(d) { return yScale(d[field]); });

            svg.append("path#co" + i)
                .translate([margins.left, margins.top]);

            d3.select("path#co" + i).transition()
                .duration(1000)
                .ease(d3.easeSinInOut)
                .attr("d", co2_line(data));

            focusHover(svg, data, selector, xScale);
        }

        function drawStrip(selector, data, co2) {
            var height, extended_height, scale, base_height, colors, field, date_type;
            if(co2 === undefined) {
                height = 80;
                extended_height = 100;
                base_height = 110;
                scale = methaneScale;
                colors = strip_color;
                field = 'mean';
                date_type = 'date';
            }

            var screen_width = window.innerWidth - margins.left - margins.right;
            var offset = (screen_width - bar_width) / 2;

            var strip = d3.select(selector).append("svg")
                .attr("width", screen_width)
                .attr("height", base_height)
                .attr("class", "svg");

            var add = strip.selectAll("bar")
                .data(data);

            add.enter()
                .append("rect")
                .merge(add)
                .attr("x", function(d) { return scale(d[date_type]); })
                .attr("width", _.floor((bar_width / data.length), 3))
                .attr("y", 0)
                .attr("height", height)
                .translate([offset, 0])
                .style("fill", function(d) { return colors(d[field]); })
                .on('mouseover touchstart', function(d) {
                    d3.select(this).attr("height", extended_height)
                        .style("fill", "lightgray");

                    tip.transition()
                        .duration(100)
                        .style("opacity", .9);

                    tip.html(
                        '<h4 class="text-center">' + d.year + '</h4>' +
                            '<ul class="list-unstyled">' +
                            '<li>Methane Levels: ' + d.mean + ' ppb</li>' +
                            '</ul>'

                        )
                        .style("top", (d3.event.pageY-88)+"px")
                        .style("left", (d3.event.pageX-25)+"px");
                })
                .on('mouseout touchend', function(d) {
                    d3.select(this).attr("height", height)
                        .style("fill", function(d) { return colors(d[field]); });

                    tip.transition()
                        .duration(250)
                        .style("opacity", 0);
                });

            add.exit().remove();

            return add;
        }

        function focusHover(chart, data, selector, xScale) {
            d3.select("body").append("div")
                .classed("tooltip tips", true)
                .style("opacity", 0);

            var tipping = d3.selectAll(".tips");

            var focus = chart.append("g")
                .attr("class", "focus")
                .style("display", "none");

            focus.append("line")
                .attr("class", "y0")
                .attr("x1", 0)
                .attr("x2", 0)
                .attr("y1", 0)
                .attr("y2", height);

            chart.append("rect")
                .attr("class", "overlay")
                .attr("width", width)
                .attr("height", height)
                .on("mouseover touchstart", function() { d3.selectAll(".focus").style("display", null); })
                .on("mouseout touchend", function() {
                    d3.selectAll(".focus").style("display", "none");
                    tipping.transition()
                        .duration(250)
                        .style("opacity", 0);
                })
                .on("mousemove touchmove", mousemove)
                .translate([margins.left, margins.top]);

            function mousemove() {
                var x0 = xScale.invert(d3.mouse(this)[0]),
                    i = bisectDate(data, x0, 1),
                    d0 = data[i - 1],
                    d1 = data[i];

                if(d1 === undefined) d1 = Infinity;
                var d = x0 - d0.date > d1.date - x0 ? d1 : d0;
                var transform_values = [(xScale(d.date) + margins.left), margins.top];
                d3.selectAll(".carbon-dioxide line.y0").translate(transform_values);

                tipping.transition()
                    .duration(100)
                    .style("opacity", .9);

                tipping.html(
                        '<h4 class="text-center">' + d.year + '</h4>' +
                            '<ul class="list-unstyled"' +
                            '<li>Emissions: ' + num_format(d.total) + ' million metric tons</li>' +
                            '</ul>'

                    )
                    .style("top", (d3.event.pageY-108)+"px")
                    .style("left", (d3.event.pageX-28)+"px");
            }

            return chart;
        }

        var rows = d3.selectAll('.row');
        rows.classed('opaque', false);
        rows.classed('hide', false);
        d3.selectAll('#load').classed('hide', true);
});