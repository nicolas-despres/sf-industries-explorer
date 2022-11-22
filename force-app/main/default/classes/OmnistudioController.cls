public with sharing class OmnistudioController {

    @AuraEnabled(cacheable=true)
    public static List<vlocity_ins__Element__c> getOmniscriptsElements(String scriptId, String type){
        String query = 'select Id, Name,vlocity_ins__Order__c, vlocity_ins__OmniScriptId__c, vlocity_ins__Type__c, ' +
          'vlocity_ins__InternalNotes__c,  vlocity_ins__PropertySet__c, vlocity_ins__ParentElementId__c '+
          'from vlocity_ins__Element__c ';
       
        if (scriptId != '') {
            query += 'where vlocity_ins__OmniScriptId__c =: scriptId';
        } else if (type != '') {
            query += ' where vlocity_ins__Type__c =: type';
        }
        return Database.query(query + ' WITH SECURITY_ENFORCED');
    }


    @AuraEnabled(cacheable=true)
    public static List<vlocity_ins__Omniscript__c> getOmniscripts(){
       
       return [select Id, Name, vlocity_ins__ProcedureKey__c, vlocity_ins__IsActive__c, vlocity_ins__SubType__c, 
       vlocity_ins__Type__c, vlocity_ins__AdditionalInformation__c, vlocity_ins__OmniProcessType__c from vlocity_ins__Omniscript__c WITH SECURITY_ENFORCED];
    }
    
    // todo: API to retrieve data raptors
    //select Id, Name from vlocity_ins__DRBundle__c
    //vlocity_ins__OrchestrationItem__c
    //vlocity_ins__OrchestrationItemDefinition__c
}
