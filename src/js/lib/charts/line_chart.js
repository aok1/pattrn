/*
Copyright (C) 2016 andrea rota <a@xelera.eu>
Copyright (C) 2015 Forensic Architecture

This file is part of Pattrn - http://pattrn.co/.

It includes code originally developed as part of version 1.0 of Pattrn and
distributed under the PATTRN-V1-LICENSE, with changes (licensed under AGPL-3.0)
adding new features and allowing integration of the legacy code with the
AGPL-3.0 Pattrn 2.0 distribution.

Pattrn is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

Pattrn is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with Pattrn.  If not, see <http://www.gnu.org/licenses/>.
*/

import d3 from 'd3';
import dc from 'dc';

/**
 * line chart
 * While transitioning from Pattrn v1 to v2: this function subsumes
 * the code manually duplicated (5x, with tiny variations) in the legacy code.
 * Pattrn v1 was handling up to 5 (hard-coded) line charts representing
 * counts of events over time. The aim of the v1->v2 refactor is to avoid
 * manual code duplication and to allow an arbitrary number of charts of this
 * type to be used in the Pattrn frontend.
 * @x-modifies-dom
 * @param {Number} index Index (integer) of this line chart within the set of line charts in use
 * @param {Object} dataset The master dataset (refactor - do we need this here?)
 * @param {Object} chart_settings Settings for this chart.
 *  * color_scale: a color scale for the chart, if not using the default one
 *    (https://github.com/dc-js/dc.js/blob/master/web/docs/api-1.6.0.md#colorscolorscale-or-colorarray)
 *  * turn_on_controls: [infer from legacy code (originally used only in line_chart_01)]
 *  * width: width of the chart (default: 300)
 *  * height: height of the chart (default: 200)
 *  * transition_duration: duration of chart animation transition
 *    (https://github.com/dc-js/dc.js/blob/master/web/docs/api-1.6.0.md#transitiondurationduration)
 *  * elements: DOM elements to update
 *    * title: chart title
 *    * chart_title: chart chart title (ehrm legacy code?)
 *    * dc_chart: d3 element of line chart
 *  * fields:
 *    * field_name: the name of the field in the dataset
 * @param {Object} pattrn_objects Pattrn objects from jumbo scope
 *  * fields:
 *    * dc: The main dc.js instance used in the app
 *    * crossfilter: The main Crossfilter instance used in the app
 *    * layer_data: Metadata of the layer for which this chart is being created
 */
export function pattrn_line_chart(index, dataset, chart_settings, pattrn_objects) {
  /**
   * Parameters passed in and defaults
   */
  let slider_chart_color_scale = chart_settings.color_scale || d3.scale.category20c(),
      turn_on_controls = chart_settings.turn_on_controls || false,
      // default from legacy code; originally hardcoded in each code snippet: 300, except line_chart_03 (150)
      chart_width = chart_settings.width || 300,
      // default from legacy code, defined as chartHeight within the main consume_table() function
      chart_height = chart_settings.height || 200,
      // legacy code uses 500ms for charts 3, 4 and 5 and doesn't override default for
      // charts 1 and 2
      chart_transition_duration = chart_settings.transition_duration || 750,

      chart_title = /*  document.getElementById(chart_settings.elements.title).innerHTML = */ chart_settings.fields.field_title + " over time",

      chart_chartTitle = document.getElementById(chart_settings.elements.chart_title)
        .innerHTML = `${chart_settings.fields.field_title} over time (${pattrn_objects.layer_data.name})`;

      let chart = dc.lineChart(chart_settings.elements.dc_chart, chart_settings.dc_chart_group);
      let chart_xf_dimension = pattrn_objects.crossfilter.dimension(function(d) {
          return !Number.isNaN(+d3.time.day(d.dd)) ? +d3.time.day(d.dd) : null;
        });

      let chart_xf_group = chart_xf_dimension.group().reduceSum(function(d) {
          return d[chart_settings.fields.field_name];
        });

  chart.width(chart_settings.scatterWidth)
    .height(chart_height)
    .margins({
      top: 0,
      right: 50,
      bottom: 50,
      left: 50
    })
    .dimension(chart_xf_dimension)
    .group(chart_xf_group)
    .transitionDuration(chart_transition_duration)
    .title(function(d) {
      return ('Total number of events: ' + d.value);
    })
    .x(d3.time.scale().domain(d3.extent(dataset, function(d) {
      return d.dd;
    })))
    .renderHorizontalGridLines(true)
    .renderVerticalGridLines(true)
    .yAxisLabel("no. of" + chart_title)
    .elasticY(true)
    .on("filtered", function(d) {
      // @x-technical-debt: do not hardcode the element id
      return document.getElementById("filterList").className = "glyphicon glyphicon-filter activeFilter";
    })
    .brushOn(true)
    .xAxis();

  chart.yAxis().ticks(3);
  if (chart_settings.turn_on_controls === true) {
    chart.turnOnControls(true);
  }
  chart.xAxis().tickFormat(d3.time.format("%d-%m-%y"));

  // AGGREGATE COUNT CHART
  var aggregateCountTitle = /* document.getElementById(chart_settings.elements.aggregate_count_title).innerHTML =*/ "Aggregate count in:" + "<br>" + "'" + chart_settings.fields.field_name + "'";

  var aggregate_count = dc.numberDisplay(chart_settings.elements.d3_aggregate_count);
  var aggregate_count_xf_dimension = pattrn_objects.crossfilter.dimension(function(d) {
    return ! Number.isNaN(+d[chart_settings.fields.field_name]) ? +d[chart_settings.fields.field_name] : null;
  });
  var aggregate_count_xf_group = aggregate_count_xf_dimension.groupAll().reduce(
    function(p, v) {
      ++p.n;
      p.tot += parseInt(v[chart_settings.fields.field_name]);
      return p;
    },
    function(p, v) {
      --p.n;
      p.tot -= parseInt(v[chart_settings.fields.field_name]);
      return p;
    },
    function() {
      return {
        n: 0,
        tot: 0
      };
    }
  );

  var average = function(d) {
    return d.n ? d.tot : 0;
  };

  aggregate_count
    .valueAccessor(average)
    .formatNumber(d3.format("d"))
    .group(aggregate_count_xf_group);

  var SliderChart = dc.lineChart(chart_settings.elements.slider_chart);
  var SliderChart_xf_dimension = pattrn_objects.crossfilter.dimension(function(d) {
    return ! Number.isNaN(+d[chart_settings.fields.field_name]) ? +d[chart_settings.fields.field_name] : null;
  });
  var SliderChart_xf_group = SliderChart_xf_dimension.group();
  var SliderChart_xf_max_value = d3.max(dataset, function(d) {
    return ! Number.isNaN(+d[chart_settings.fields.field_name]) ? +d[chart_settings.fields.field_name] : null;
  });

  SliderChart.width(125)
    .height(chart_height / 3)
    .transitionDuration(500)
    .margins({
      top: 0,
      right: 10,
      bottom: 30,
      left: 4
    })
    .dimension(SliderChart_xf_dimension)
    .group(SliderChart_xf_group)
    .colors(slider_chart_color_scale)
    .on(`renderlet.${chart_settings.elements.title}`, function(chart) {
      // set svg background colour
      chart.svg().select('.chart-body').append('rect').attr('fill', '#3e4651').attr('height', chart_height).attr('width', chart_width);
    })
    .on("filtered", function(d) {
      // @x-technical-debt: do not hardcode the element id
      // @x-technical-debt: switch to D3 v4 API
      pattrn_objects.dispatch.filter();
      return document.getElementById("filterList").className = "glyphicon glyphicon-filter activeFilter";
    })
    .x(d3.scale.linear().domain([0, (SliderChart_xf_max_value + 1)]));
  // SliderChart_03 and SliderChart_05 in legacy code further concatenate a
  // call to .xAxis() here - likely spurious, but to be reviewed

  SliderChart.xAxis().ticks(3);

  return chart;
}
