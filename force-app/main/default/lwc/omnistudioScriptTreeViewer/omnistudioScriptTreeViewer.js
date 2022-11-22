/* eslint-disable no-undef */
import { LightningElement, api } from 'lwc'
import { ShowToastEvent } from 'lightning/platformShowToastEvent'
import getOmniscriptsElements from '@salesforce/apex/OmnistudioController.getOmniscriptsElements'
import getOmniscripts from '@salesforce/apex/OmnistudioController.getOmniscripts'
import { OmniscriptController } from 'c/omnistudioController'

const COLUMNS_DEFINITION = [
	{
		type: 'text',
		fieldName: 'name',
		label: 'Name',
		initialWidth: 300,
	},
	{
		type: 'url',
		fieldName: 'url',
		label: 'Type',
		typeAttributes: {
			label: { fieldName: 'type' },
		},
	},
	{
		type: 'text',
		fieldName: 'notes',
		label: 'Notes',
	},
	{
		type: 'text',
		fieldName: 'owner',
		label: 'Owner',
	},
]

function asTreeData(input) {
	var res =  {
		...input,
		name: input.name || input.type,
		key: input.key || (input.id  + input.name),
		url: input.id ? '/' + input.id : ''
	}
	if (input.children) {
		res._children = input.children.map(asTreeData)
	}
	return res
}

export default class CalendarChart extends LightningElement {

	@api
	recordId
	isLoaded = false
	treeData = undefined
	gridColumns = COLUMNS_DEFINITION

	get gridTreeData() {
		return this.treeData?.children?.map(asTreeData)
	}
	
	renderedCallback() {

		if (!this.isLoaded) {
			Promise.all([
				getOmniscripts(),
				getOmniscriptsElements({ scriptId: '', type: 'Integration Procedure Action' }),
			])
				.then(async ([omniscripts, allIntegrationProcedureActions]) => {
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
				})
				.catch((error) => {
					console.error(error)
					this.dispatchEvent(
						new ShowToastEvent({
							title: 'Error preloading component ',
							message: error?.body?.message || error.message,
							variant: 'error',
						})
					)
				})
		}
	}
}