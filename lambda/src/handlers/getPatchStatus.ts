import { unmarshall } from "@aws-sdk/util-dynamodb";
import { dynamodb } from "../index.js";
import { ScanCommand } from "@aws-sdk/client-dynamodb";

export async function getAllPatchStatus() {
    const result = await dynamodb.send(
        new ScanCommand({
            TableName: process.env.PATCH_STATUS_TABLE!,
        }),
    );

    return result.Items?.map((item) => unmarshall(item)) ?? [];
}

export const handler = async () => {
    try {
        const items = await getAllPatchStatus();

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(items),
        };
    } catch (error) {
        console.error(error);

        return {
            statusCode: 500,
            body: JSON.stringify({
                error: "Failed to retrieve patch status",
            }),
        };
    }
};
