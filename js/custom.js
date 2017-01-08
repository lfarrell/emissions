d3.queue()
    .defer(d3.csv,'processed/total_global_co_2.csv')
    .defer(d3.csv,'processed/methane.csv')
    .await(function(error, co2, methane) {

        var tip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);

        var margins = {top: 45, right: 50, bottom: 50, left: 50},
            height = 300 - margins.top - margins.bottom,
            bar_width = 300,
            stream_height = 800 - margins.top - margins.bottom,
            stream_width = window.innerWidth - margins.left - margins.right,
            parse_year = d3.timeParse("%Y"),
            num_format = d3.format(",");

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
        var xScale = d3.scaleTime()
            .range([0, stream_width]);
        xScale.domain(d3.extent(co2, d3.f('date')));

        /* Stream graph */
        var color = d3.scaleOrdinal()
          //  .range(['rgb(147, 94, 91)', 'rgb(47, 117, 131)', 'rgb(47, 117, 131', 'rgb(115, 110, 17)','rgb(179, 76, 48)'])
            .range(['#fee5d9','#fcae91','#fb6a4a','#de2d26','#a50f15'].reverse())
           // .range(['#a6611a','#dfc27d','#f5f5f5','#80cdc1','#018571'].reverse());
        var stack = d3.stack()
            .keys(fields)
            .order(d3.stackOrderNone)
            .offset(d3.stackOffsetWiggle);

        var series = stack(co2);
        var y = d3.scaleLinear()
            .domain([0, d3.max(series, function(layer) { return d3.max(layer, function(d){ return d[0] + d[1];}); })])
            .range([stream_height, 0]);

        var area = d3.area()
            .x(function(d) { return xScale(d.data.date); })
            .y0(function(d) { return y(d[0]); })
            .y1(function(d) { return y(d[1]); })
            .curve(d3.curveBasis);

        var xStreamTopAxis = d3.axisTop(xScale);
        var xStreamBottomAxis = d3.axisBottom(xScale);

        var field_names = fields.map(function(field_name) {
            return fieldName(field_name, true);
        });

        drawLegend("#co-two-total-legend", color.domain(field_names), true);

        var svg = d3.select("#co-two-total").append("svg")
            .attr("width", stream_width + margins.left + margins.right)
            .attr("height", stream_height + margins.top + margins.bottom)
            .append("g")
            .attr("class", "stream")
            .translate([0, -305]);

        svg.selectAll("path")
            .data(series)
            .enter().append("path")
            .attr("d", area)
            .style("fill", function(d, i) { return color(fields[i]); })
            .on('mouseover touchstart', function(d) {
                d3.select(this).style("opacity", .81);
            })
            .on("mousemove touchmove", function(d, i) {
                var inverted = xScale.invert(d3.mouse(this)[0]);
                var year = inverted.getFullYear();
                var year_data = _.find(co2, function(d){ return d.year == year; });

                tip.transition()
                    .duration(100)
                    .style("opacity", .9);

                tip.html(
                        '<h5 class="text-center">' + fieldName(fields[i], true) + ' (' + year_data.year + ')</h5>' +
                            '<ul class="list-unstyled">' +
                            '<li>Total Levels: ' + num_format(year_data.total) + ' mmt</li>' +
                            '<li>' + fieldName(fields[i], true) + ' Levels: ' + num_format(year_data[fields[i]]) + ' mmt</li>' +
                            '</ul>'
                    )
                    .style("top", (d3.event.pageY-108)+"px")
                    .style("left", (d3.event.pageX-110)+"px");

            })
            .on("mouseout touchend", function(d) {
                d3.select(this).style("opacity", 1);
                tip.transition()
                    .duration(250)
                    .style("opacity", 0);
            });

        svg.append("g")
            .attr("class", "axis")
            .translate([0, 340])
            .call(xStreamTopAxis);

        svg.append("g")
            .attr("class", "axis")
            .translate([0, 1000])
            .call(xStreamBottomAxis);

        // Small multiples
        fields.forEach(function(field_name, i) {
            d3.select("#co-two").append("div")
                .attr("class", "graph")
                .attr("id", "graphed" + i);

            d3.select("#graphed" + i)
                .append("h4")
                .attr("class", "text-center")
                .text(fieldName(field_name, true));

            drawGraph("#graphed" + i, field_name, i);
        });

        var colors = ['#67001f','#b2182b','#d6604d','#f4a582','#fddbc7','#f7f7f7','#d1e5f0','#92c5de','#4393c3','#2166ac','#053061'].reverse();
        var strip_color = d3.scaleQuantize()
            .domain(d3.extent(methane, d3.f('mean')))
            .range(colors);
        drawLegend("#methane-legend", strip_color, false);
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
                .scale(xScale)
                .ticks(8);

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

            focusHover(svg, data, xScale, yScale);
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

        function focusHover(chart, data, xScale, yScale) {
            var focus = chart.append("g")
                .attr("class", "focus")
                .style("display", "none");

            focus.append("circle")
                .attr("class", "y0")
                .attr("r", 2.5);

            focus.append("text")
                .attr("class", "y0")
                .attr("x", 9)
                .attr("dy", ".35em");

            chart.append("rect")
                .attr("class", "overlay")
                .attr("width", width)
                .attr("height", height)
                .on("mouseover touchstart", function() { d3.selectAll(".focus").style("display", null); })
                .on("mouseout touchend", function() {
                    d3.selectAll(".focus").style("display", "none");
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

                fields.forEach(function(field, i) {
                    var transform_values = [(xScale(d.date) + margins.left), (yScale(d[field]) + margins.top)];

                    d3.select("#graphed" + i + " circle.y0").translate(transform_values);
                    d3.select("#graphed" + i + " text.y0").translate(transform_values)
                        .tspans(function(e) {
                            return ["Emissions: " + num_format(d[field]), fieldName(field, false) + " (" + d.year + ")"];
                        }, -15);
                });
            }

            return chart;
        }

        function drawLegend(selector, strip_colors, wide) {
            var width = window.innerWidth;
            var month_graph = /month/.test(selector);
            var size, orientation;

            if(width < 900) {
                size = 40;
                orientation = 'vertical';
            } else if(wide) {
                size = 110;
                orientation = 'horizontal';
            } else {
                size = 90;
                orientation = 'horizontal';
            }

            var legend_height = (orientation === 'vertical') ? 230 : 75;
            var legend_width = (width < 900 || month_graph) ? 130 : width - 10;
            var class_name = selector.substr(1);
            var svg = d3.select(selector).append("svg")
                .classed("legend", true)
                .attr("width", legend_width)
                .attr("height", legend_height);

            svg.append("g")
                .attr("class", "legend-" + class_name)
                .attr("width", legend_width)
                .translate([0, 20]);

            var legend = d3.legendColor()
                .shapeWidth(size)
                .orient(orientation)
                .labelFormat(d3.format(".01f"))
                .scale(strip_colors);

            svg.select(".legend-" + class_name)
                .call(legend);

            return svg;
        }

        function annotate(selector, annotations) {
            var swoopy = d3.swoopyDrag()
                .x(function(d){ return d.xVal; })
                .y(function(d){ return d.yVal; })
                .draggable(0);

            swoopy.annotations(annotations);

            d3.select(selector + " .svg").append("g.annotations").call(swoopy);
        }

        function fieldName(field_name, full) {
            var title = field_name.split("_");

            if(!full && title[1] == "flaring") {
                return _.capitalize(title[1]);
            } else if(!full) {
                return _.capitalize(title[0]);
            } else {
                return _.capitalize(title[0]) + ' ' + _.capitalize(title[1])
            }
        }

        var rows = d3.selectAll('.row');
        rows.classed('opaque', false);
        rows.classed('hide', false);
        d3.selectAll('#load').classed('hide', true);
});