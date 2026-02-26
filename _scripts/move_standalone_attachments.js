const TARGET_COLLECTION_NAME = "temp_unused_citations";
const GROUP_NAME = "d4dasia";

async function moveStandaloneItems() {
    Zotero.debug("--- STARTING FULL STANDALONE MOVE ---");
    
    let group = Zotero.Groups.getAll().find(g => g.name.toLowerCase() === GROUP_NAME.toLowerCase());
    if (!group) return "Group not found";

    let libraryID = parseInt(group.libraryID);
    
    // 1. Get/Create Collection
    let collections = Zotero.Collections.getByLibrary(libraryID);
    let targetColl = collections.find(c => c.name === TARGET_COLLECTION_NAME);
    
    if (!targetColl) {
        targetColl = new Zotero.Collection();
        targetColl.name = TARGET_COLLECTION_NAME;
        targetColl.libraryID = libraryID;
        await targetColl.saveTx();
    }
    let targetCollID = parseInt(targetColl.id);

    // 2. Get IDs including attachments/notes
    let itemIDs = await Zotero.Items.getAll(libraryID, false, false, true);
    let movedCount = 0;

    for (let id of itemIDs) {
        let item = await Zotero.Items.getAsync(id);
        
        // Standalone check: (Attachment OR Note) AND no parent
        if (item && (item.isAttachment() || item.isNote()) && !item.parentID) {
            Zotero.debug("Moving standalone: " + item.getField('title'));
            
            // Set collections list to ONLY target collection (True Move)
            item.setCollections([targetCollID]);
            await item.saveTx();
            movedCount++;
        }
    }

    const msg = `FULL MOVE COMPLETE.\nSuccessfully moved ${movedCount} standalone items to '${TARGET_COLLECTION_NAME}'.\nYour library root should now be cleaner.`;
    alert(msg);
    return msg;
}

moveStandaloneItems().catch(err => {
    Zotero.debug(err);
    alert("Error: " + err);
});
