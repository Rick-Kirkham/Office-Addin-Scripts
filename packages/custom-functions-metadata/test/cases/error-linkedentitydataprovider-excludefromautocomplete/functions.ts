// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

/**
 * Test the linkedEntityDataProvider tag in combination with the excludeFromAutoComplete tag
 * @param {unknown} linkedEntityId Unique `LinkedEntityId` of the `LinkedEntityCellValue`s which is being requested for resolution/refresh.
 * @customfunction
 * @linkedEntityDataProvider
 * @excludeFromAutoComplete
 * @returns {Promise<any>} Resolved/Updated `LinkedEntityCellValue` that was requested by the passed-in id.
 */
async function linkedEntityDataProviderTest(linkedEntityId: unknown): Promise<any> {
    // Empty
}
