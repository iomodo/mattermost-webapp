// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @bot_accounts @not_cloud

import {createBotPatch} from '../../support/api/bots';
import {generateRandomUser} from '../../support/api/user';

describe('Bot accounts', () => {
    let team;
    let channel;
    let testUser;
    let bots;
    let createdUsers;

    before(() => {
        cy.shouldNotRunOnCloudEdition();

        cy.apiInitSetup().then((out) => {
            team = out.team;
            channel = out.channel;
            testUser = out.user;
        });

        cy.makeClient().then(async (client) => {
            // # Create bots
            bots = await Promise.all([
                client.createBot(createBotPatch()),
                client.createBot(createBotPatch()),
                client.createBot(createBotPatch()),
            ]);

            // # Create users
            createdUsers = await Promise.all([
                client.createUser(generateRandomUser()),
                client.createUser(generateRandomUser()),
            ]);

            await Promise.all([
                ...bots,
                ...createdUsers,
            ].map(async (user) => {
                // * Verify username exists
                cy.wrap(user).its('username');

                // # Add to team and channel
                await client.addToTeam(team.id, user.user_id ?? user.id);
                await client.addToChannel(user.user_id ?? user.id, channel.id);
            }));
        });
    });

    beforeEach(() => {
        cy.apiAdminLogin();
    });

    it('MM-T1836 Bot accounts display', () => {
        // # Login as regular user and visit a channel
        cy.apiLogin(testUser);
        cy.visit(`/${team.name}/messages/@${bots[0].username}`);

        cy.get('.SidebarChannelGroup:contains(DIRECT MESSAGES) .SidebarChannel.active > .SidebarLink').then(($link) => {
            // * Verify DM label
            cy.wrap($link).find('.SidebarChannelLinkLabel').should('have.text', bots[0].username);

            // * Verify bot icon exists
            cy.wrap($link).find('.Avatar').should('exist').
                and('have.attr', 'src').
                then((url) => cy.request({url, encoding: 'binary'})).
                should(({body}) => {
                    // * Verify it matches default bot avatar
                    cy.fixture('bot-default-avatar.png', 'binary').should('deep.equal', body);
                });
        });

        cy.postMessage('Bump bot chat recency');

        // # Open a new DM
        cy.visit(`/${team.name}/messages/@${createdUsers[0].username}`);
        cy.postMessage('Hello, regular user');

        // * Verify Bots and Regular users as siblings in DMs
        cy.get('.SidebarChannelGroup:contains(DIRECT MESSAGES) .SidebarChannel.active').siblings('.SidebarChannel').then(($siblings) => {
            cy.wrap($siblings).contains('.SidebarChannelLinkLabel', bots[0].username);
        });
    });
});
