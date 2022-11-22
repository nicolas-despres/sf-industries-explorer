/* eslint-disable no-undef */
import { LightningElement, api } from 'lwc'
import { loadScript } from 'lightning/platformResourceLoader'
import D3 from '@salesforce/resourceUrl/d3'
import { ShowToastEvent } from 'lightning/platformShowToastEvent'
import getOmniscriptsElements from '@salesforce/apex/OmnistudioController.getOmniscriptsElements'
import getOmniscripts from '@salesforce/apex/OmnistudioController.getOmniscripts'
import { OmniscriptController } from 'c/omnistudioController'


export default class OmnistudioGraph extends LightningElement {

	@api
	recordId

	treeData = undefined
	
	svgWidth = 1300
	svgHeight = 750
	svg = undefined

	isLoaded = false
	selectedId = undefined
	selectedUrl = undefined
	selectedElement = {}

	selected = 'none'
	
	pos = 0
	

	handleClickLeft() {
		this.pos += -10
		this.svg.attr("transform", "translate(" + this.pos + ",0)")
	}
	handleClickRight() {
		this.pos += 10
		this.svg.attr("transform", "translate(" + this.pos + ",0)")
	}
	renderedCallback() {
		if (!this.isLoaded) {
			Promise.all([
				loadScript(this, D3 + '/d3.min.js'),
				getOmniscripts(),
				getOmniscriptsElements({ scriptId: '', type: 'Integration Procedure Action' }),
			])
				.then(async ([, omniscripts, allIntegrationProcedureActions]) => {
					this.isLoaded = true;
					let controller = new OmniscriptController(
						{
							omniscripts,
							allIntegrationProcedureActions
						})

					this.treeData = (await controller.omnistudioElement(
						{
							Id: this.recordId,
							Name: controller.getOmniscript(this.recordId)?.Name,
							vlocity_ins__Type__c: 'OmniScriptElement',
						}))

					this.draw()
				})
				.catch((error) => {
					console.error(error)
					this.dispatchEvent(
						new ShowToastEvent({
							title: 'Error preloading component ',
							message: error?.body?.message || error.message,
							variant: 'error',
						})
					);
				});
		}
	}

	onClick(d) {
		this.selectedName = `${d.data.name} (${d.data.type})`
		this.selectedUrl = '/' + d.data.id
		this.selectedElement = d.data
		const selectEvent = new CustomEvent('select', {
			detail: { recordId: d.data.id }
		})
		this.dispatchEvent(selectEvent);
	}

	async draw() {
		if (!this.isLoaded)
			return

		// Set the dimensions and margins of the diagram
		let margin = { top: 20, right: 90, bottom: 30, left: 90 },
			width = this.svgWidth - margin.left - margin.right,
			height = this.svgHeight - margin.top - margin.bottom;

		this.svg = d3.select(this.template.querySelector('svg.flowchart'))
			.append("g")
			.attr("transform", "translate("
				+ (margin.left + this.pos) + "," + margin.top + ")");

		let i = 0,
			duration = 750,
			root;

		// declares a tree layout and assigns the size
		let treemap = d3.tree().size([height, width]);

		// Assigns parent, children, height, depth
		root = d3.hierarchy(this.treeData, function (d) { return d.children; });
		root.x0 = height / 2;
		root.y0 = 0;

		// Collapse after the second level
		root.children.forEach(collapse);

		update.call(this, root)
		//update.call(this, root)

		// Collapse the node and all it's children
		function collapse(d) {
			if (d.children) {
				d._children = d.children
				d._children.forEach(collapse)
				d.children = null
			}
		}

		function update(source) {

			// Assigns the x and y position for the nodes
			var treeData = treemap(root);

			// Compute the new tree layout.
			var nodes = treeData.descendants(),
				links = treeData.descendants().slice(1);

			// Normalize for fixed-depth.
			nodes.forEach(function (d) { d.y = d.depth * 220 });

			// ****************** Nodes section ***************************

			// Update the nodes...
			let node = this.svg.selectAll('g.node')
				.data(nodes, function (d) {

					return d.id || (d.id = ++i);
				});
			if (!node)
				return

			// Enter any new modes at the parent's previous position.
			let nodeEnter = node.enter().append('g')
				.attr('class', 'node')
				.attr("transform", function () {
					return "translate(" + source.y0 + "," + source.x0 + ")";
				})
				.on('click', handleClick.bind(this));

			// Add Circle for the nodes
			nodeEnter.append('circle')
				.attr('class', 'node')
				.attr('r', 1e-6)
				.style("stroke", "steelblue")
				.style("stroke-width", "1px")
				.style("fill", function (d) {
					if (getRoot(d).selected === d.id) {
						return "orange"
					}

					return d._children ? "lightsteelblue" : "#ccc";
				})
			/*.on("mouseover", function(d) {		
				tooltip.transition()		
					.duration(200)		
					.style("opacity", .9)	
					.text(d.data.name + d.id)	
					.style("left", (d3.event.pageX) + "px")		
					.style("top", (d3.event.pageY - 28) + "px");	
				})					
			.on("mouseout", function(d) {		
				tooltip.transition()		
					.duration(500)		
					.style("opacity", 0);	
			});*/

			// Add labels for the nodes
			nodeEnter.append('text')
				.attr("dy", ".35em")
				.attr("x", -13)
				.attr("text-anchor", "end")
				.text(function (d) { return d.data.name });

			nodeEnter.append('text')
				.attr("dy", ".35em")
				.attr("x", -6.5)
				.attr("title", function (d) { return d.data.type })
				.text((d) => d.data.icon);

			nodeEnter
				.append('svg:title')
				.text((d) => (d.data.type || '') + (d.data.notes || ''));

			// UPDATE
			let nodeUpdate = nodeEnter.merge(node);

			// Transition to the proper position for the node
			nodeUpdate.transition()
				.duration(duration)
				.attr("transform", function (d) {
					return "translate(" + d.y + "," + d.x + ")";
				});

			// Update the node attributes and style
			nodeUpdate.select('circle.node')
				.attr('r', 10)
				.style("fill", function (d) {
					if (getRoot(d).selected === d.id) {
						return "orange"
					}
					return d._children ? "lightsteelblue" : "#fff";
				})
				.attr('cursor', 'pointer');


			// Remove any exiting nodes
			let nodeExit = node.exit().transition()
				.duration(duration)
				.attr("transform", function () {
					return "translate(" + source.y + "," + source.x + ")";
				})
				.remove();

			// On exit reduce the node circles size to 0
			nodeExit.select('circle')
				.attr('r', 1e-6);

			// On exit reduce the opacity of text labels
			nodeExit.select('text')
				.style('fill-opacity', 1e-6);

			// ****************** links section ***************************

			// Update the links...
			let link = this.svg.selectAll('path.link')
				.data(links, function (d) { return d.id; });

			// Enter any new links at the parent's previous position.
			let linkEnter = link.enter().insert('path', "g")
				.attr("class", "link")
				.attr("stroke", function (d) { return d.data.rank === 0 ? '#ccc' : '#fff' })
				.attr("fill", "none")
				.attr("stroke-width", "1px")
				.attr('d', function () {
					var o = { x: source.x0, y: source.y0 }
					return diagonal(o, o)
				});

			// UPDATE
			let linkUpdate = linkEnter.merge(link);

			// Transition back to the parent element position
			linkUpdate.transition()
				.duration(duration)
				.attr('d', function (d) { return diagonal(d, d.parent) });

			// Remove any exiting links
			link.exit().transition()
				.duration(duration)
				.attr('d', function () {
					var o = { x: source.x, y: source.y }
					return diagonal(o, o)
				})
				.remove();

			// Store the old positions for transition.
			nodes.forEach(function (d) {
				d.x0 = d.x;
				d.y0 = d.y;
			});

			// Creates a curved (diagonal) path from parent to the child nodes
			function diagonal(s, d) {

				var path = `M ${s.y} ${s.x}
						C ${(s.y + d.y) / 2} ${s.x},
						  ${(s.y + d.y) / 2} ${d.x},
						  ${d.y} ${d.x}`

				return path
			}

			function getRoot(d) {
				if (d.parent) { return getRoot(d.parent) }
				return d
			}
			function handleClick(d) {
				if (d.children) {
					d._children = d.children;
					d.children = null;
				} else {
					d.children = d._children;
					d._children = null;
				}
				getRoot(d).selected = d.id
				update.call(this, d);
				this.onClick(d);
			}
		}
	}
}