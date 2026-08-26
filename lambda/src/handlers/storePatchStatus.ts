import { GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { dynamodb } from "../index.js";

type PatchReport = {
    host?: string;
    run_id?: string;
    workflow?: "patch" | "sanity_reboot";
    stage?: string;
    stage_status?: "in_progress" | "completed" | "failed";
    pre_check_status?: Record<string, unknown>;
    services_status?: Record<string, unknown>;
    patch_status?: Record<string, unknown>;
    reboot_status?: string;
    services_status_after_reboot?: Record<string, unknown>;
    [key: string]: unknown;
};

type HttpApiEvent = { body?: string };

const stagesByWorkflow = {
    patch: ["pre_check", "stop_services", "patch", "reboot", "service_health_check"],
    sanity_reboot: ["pre_check", "stop_services", "sanity_reboot", "service_health_check"],
};

export const handler = async (event: HttpApiEvent) => {
    try {
        const report = JSON.parse(event.body ?? "{}") as PatchReport;
        const {
            host,
            run_id: runId,
            workflow = "patch",
            stage = "complete",
            stage_status: stageStatus = "completed",
            pre_check_status: preCheckStatus,
            services_status: servicesStatus,
            patch_status: patchStatus,
            reboot_status: rebootStatus,
            services_status_after_reboot: serviceHealthStatus,
        } = report;

        if (!host || !runId || !report.workflow) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "The report must include host, run_id, and workflow fields." }),
            };
        }

        const tableName = process.env.PATCH_STATUS_TABLE!;
        const id = `${host}#${runId}`;
        const existingResult = await dynamodb.send(new GetItemCommand({
            TableName: tableName,
            Key: marshall({ id }),
        }));
        const existing = existingResult.Item ? unmarshall(existingResult.Item) as Record<string, unknown> : {};
        const now = new Date().toISOString();
        const previousStages = (existing.stages ?? {}) as Record<string, Record<string, unknown>>;
        const stages = Object.fromEntries(
            (stagesByWorkflow[workflow] ?? [stage]).map((stageName) => [
                stageName,
                previousStages[stageName] ?? { status: "pending" },
            ]),
        ) as Record<string, Record<string, unknown>>;

        const resultForStage: Record<string, unknown> =
            stage === "pre_check" && preCheckStatus ? { pre_check_status: preCheckStatus } :
                stage === "stop_services" && servicesStatus ? { services_status: servicesStatus } :
                    stage === "patch" && patchStatus ? { patch_status: patchStatus } :
                        ["sanity_reboot", "reboot"].includes(stage) && rebootStatus ? { reboot_status: rebootStatus } :
                            stage === "service_health_check" && serviceHealthStatus ? { services_status_after_reboot: serviceHealthStatus } :
                                {};

        stages[stage] = {
            ...(stages[stage] ?? {}),
            ...resultForStage,
            status: stageStatus,
            updatedAt: now,
        };

        const {
            host: _host,
            run_id: _runId,
            workflow: _workflow,
            stage: _stage,
            stage_status: _stageStatus,
            updated_at: _updatedAt,
            pre_check_status: _preCheckStatus,
            services_status: _servicesStatus,
            patch_status: _patchStatus,
            reboot_status: _rebootStatus,
            services_status_after_reboot: _serviceHealthStatus,
            ...reportDetails
        } = report;
        const {
            pre_check_status: _oldPreCheckStatus,
            services_status: _oldServicesStatus,
            patch_status: _oldPatchStatus,
            reboot_status: _oldRebootStatus,
            services_status_after_reboot: _oldServiceHealthStatus,
            ...existingDetails
        } = existing;

        const item = {
            ...existingDetails,
            ...reportDetails,
            id,
            host,
            runId,
            workflow,
            status: stageStatus === "failed"
                ? "failed"
                : stage === "service_health_check"
                    ? "completed"
                    : "running",
            currentStage: stage,
            stages,
            startedAt: existing.startedAt ?? now,
            updatedAt: now,
        };

        await dynamodb.send(new PutItemCommand({
            TableName: tableName,
            Item: marshall(item, { removeUndefinedValues: true }),
        }));

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: "Report stage stored", host, run_id: runId, stage }),
        };
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to store patch report." }),
        };
    }
};
