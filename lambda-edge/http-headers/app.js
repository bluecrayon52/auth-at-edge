// Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { readFileSync } from 'fs';
import { asCloudFrontHeaders } from '../shared/app';

const configuredHeaders = getConfiguredHeaders();

export const handler = async (event) => {
    const resp = event.Records[0].cf.response;
    Object.assign(resp.headers, configuredHeaders);
    return resp;
};

function getConfiguredHeaders() {
    const headers = JSON.parse(readFileSync(`${__dirname}/configuration.json`).toString('utf8'));
    return asCloudFrontHeaders(headers);
}