
import getOmniscriptsElements from '@salesforce/apex/OmnistudioController.getOmniscriptsElements'

export const types = {
    'Integration Procedure Action': '🚀',
    'OmniScript': '🪄',
    'Step': '💬',
    'Remote Action': '✨',
    'Set Values': '✏️',
    'Response Action': '',
    'Rest Action': '🛏️',
    'DataRaptor Post Action': '📬'
}

class OmnistudioElement {
    constructor(data, controller) {
        this.data = data
        this.id = data.Id
        this.name = data.Name
        this.type = data.vlocity_ins__Type__c
        this.controller = controller
        if (data.vlocity_ins__PropertySet__c) {
            try {
                this.properties = JSON.parse(data.vlocity_ins__PropertySet__c)
                this.name = this.properties.label || this.name
                if (this.properties.show) {
                    //this.condition = 
                }
            } catch (e) {
                console.log('unexpected error')
            }
        }
        this.name = this.name?.replace(/(.{25})..+/, "$1…");

    }
    get icon() {
        return types[this.type] || '🪄'
    }

    asGraphviz() {
        return ''
    }
}

class Group extends OmnistudioElement {

    constructor(data, controller) {
        super(data, controller)
        this.type = 'Group'
        this.children = data.children
    }

    get icon() {
        return '📦'
    }
}

class Step extends OmnistudioElement {
    get icon() {
        return '👤' 
    }
}

class LWC extends OmnistudioElement {
    get icon() {
        return '👣'
    }
}

class Omniscript extends OmnistudioElement {
    constructor(data, controller) {
        return (async () => {
            super(data, controller)
            this.type = data.vlocity_ins__OmniProcessType__c || this.type
            this.children = await this.getSteps()
            this.notes = data.vlocity_ins__AdditionalInformation__c
            return this
        })()
    }

    async getSteps() {
        let elements = (await getOmniscriptsElements({ scriptId: this.id, type: '' })).slice()
            .sort((a, b) => a.vlocity_ins__Order__c - b.vlocity_ins__Order__c)
            .filter(item => item.vlocity_ins__ParentElementId__c === undefined)
        const steps = await Promise.all(elements.map(item => this.controller.omnistudioElement(item)))
        return steps.length < 7 ? steps : steps.reduce((prev, cur, index) => {
            if (cur.type === 'Step') {
                //a simple step, add it in the array
                cur.rank = index
                prev.push(cur)
            } else {
                if (prev.length > 0) {
                    // previous step is not a step, create a group or add it to a group
                    let last = prev[prev.length - 1]
                    if (last.type === 'Group') {
                        last.children.push(cur)
                    } else {
                        let group = new Group({ Name: '', children: [cur] }, this.controller)
                        prev.push(group)
                    }
                } else {
                    let group = new Group({ Name: 'Initialization', children: [cur] }, this.controller)
                    group.rank = 0
                    prev.push(group)
                }
            }
            return prev
        }, [])
    }

    get icon() {
        return '🔌'
    }
}

function getPayload(obj, id) {
    return {
        name: 'Sending',
        key: 'sending' + id,
        children: Object.keys(obj).map(key => {
            return {
                name: key,
                notes: JSON.stringify(obj[key]),
                key: id + key,
            }
        })
    }
}
class OmniscriptAction extends OmnistudioElement {
    constructor(data, controller) {
        return (async () => {
            super(data, controller)
            this.targetSubType = this.properties["Sub Type"]
            this.targetType = this.properties.Type
            this.children = await this.getChildren()
            if (this.properties.extraPayload && Object.keys(this.properties.extraPayload).length > 0) {
                this.children.push(getPayload(this.properties.extraPayload), this.id)
            }
            if (this.properties.remoteOptions) {
                this.children.push(getPayload(this.properties.remoteOptions), this.id)
            }
            return this
        })()

    }
    async getChildren() {
        const omniscript = this.getRelatedOmniscript()
        if (!omniscript)
            return []
        const rep = await new Omniscript(omniscript, this.controller)
        return [rep]
    }
    get icon() {
        return '🫂'
    }
    getRelatedOmniscript() {
        return this.controller.omniscripts.find(item => item.vlocity_ins__SubType__c === this.targetSubType && item.vlocity_ins__Type__c === this.targetType)
    }
}

class RemoteAction extends OmnistudioElement {
    constructor(data, controller) {
        return (async () => {
            super(data, controller)

            this.remoteClass = this.properties?.remoteClass
            this.remoteMethod = this.properties?.remoteMethod
            this.children = [{
                name: this.remoteClass,
            }, { name: this.remoteMethod }]
            if (this.properties.extraPayload && Object.keys(this.properties.extraPayload).length > 0) {
                this.children.push(getPayload(this.properties.extraPayload), this.id)
            }
            if (this.properties.remoteOptions) {
                this.children.push(getPayload(this.properties.remoteOptions), this.id)
            }
            return this
        })()

    }
    get icon() {
        return '🔌'
    }
}



class IntegrationProcedure extends OmnistudioElement {
  
    constructor(data, controller) {
        return (async () => {
            super(data, controller)
            this.integrationProcedureKey = this.properties.integrationProcedureKey
            this.children = await this.getChildren()
            if (this.properties.extraPayload) {
                this.children.push(getPayload(this.properties.extraPayload))
            }
            return this
        })()
    }

    async getChildren() {
        const omniscript = this.getRelatedOmniscript()

        if (!omniscript)
            return []
        const rep = await new Omniscript(omniscript, this.controller)
        return [rep]
    }
    get icon() {
        return '💬'
    }
    getRelatedOmniscript() {
        return this.controller.omniscripts.find(item => item.vlocity_ins__ProcedureKey__c === this.integrationProcedureKey)
    }
}

const mapping = {
    'Integration Procedure Action': IntegrationProcedure,
    'OmniScriptElement': Omniscript,
    'OmniScript': OmniscriptAction,
    'Remote Action': RemoteAction,
    'Step': Step,
    'Custom Lightning Web Component': LWC,
}

export async function getCorrespondingElement(data, controller) {
    const Category = mapping[data.vlocity_ins__Type__c] || OmnistudioElement
    const res = await new Category(data, controller)
    return res
}


export class OmniscriptController {
    allIntegrationProcedureActions = undefined
    omniscripts = undefined

    constructor({ omniscripts, allIntegrationProcedureActions }) {
        this.omniscripts = omniscripts
        this.allIntegrationProcedureActions = allIntegrationProcedureActions
    }

    getOmniscript(id) {
        return this.omniscripts.find(item => item.Id === id)
    }

    /**
     * 
     * @param {vlocity_ins__Element__c} element
     * @return {{Name:String, Type: Enum, children:Array}} Corresponding tree node representation
     */
    async omnistudioElement(element) {
        return getCorrespondingElement(element, this)


        /*  const stringToSearch = data.integrationProcedureKey ? data.integrationProcedureKey : JSON.stringify(`"Type":"${data.Type}","Sub Type":"${data["Sub Type"]}"`)
          let dependencies = this.allIntegrationProcedureActions.filter((item) => item.vlocity_ins__PropertySet__c.indexOf(stringToSearch) > -1)
              .filter(item => this.getOmniscript(item.vlocity_ins__OmniScriptId__c)?.vlocity_ins__IsActive__c)
              .map(item => {
                  const omniscript = this.getOmniscript(item.vlocity_ins__OmniScriptId__c)
                  return {
                      name: omniscript.Name,
                      id: omniscript.Id,
                      type: item.vlocity_ins__Type__c
                  }
              })
          if (dependencies) {
              res.children.push({
                  name: 'Dependencies',
                  children: dependencies
              })
          }
      }*/


    }
}


