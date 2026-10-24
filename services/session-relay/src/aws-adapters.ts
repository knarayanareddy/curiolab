import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
  DeleteConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import type { RelayStore, RelaySession, RelayDelivery } from "./broker.js";
export class DynamoRelayStore implements RelayStore {
  constructor(
    private readonly db: Pick<DynamoDBDocumentClient, "send">,
    private readonly table: string,
  ) {}
  async get(id: string): Promise<RelaySession | undefined> {
    const result = await this.db.send(
      new GetCommand({
        TableName: this.table,
        Key: { pk: `SESSION#${id}` },
        ConsistentRead: true,
      }),
    );
    return result.Item?.session as RelaySession | undefined;
  }
  async save(session: RelaySession, expectedVersion: number): Promise<boolean> {
    try {
      await this.db.send(
        new PutCommand({
          TableName: this.table,
          Item: {
            pk: `SESSION#${session.id}`,
            version: session.version,
            ttl: session.ttl,
            session,
          },
          ConditionExpression: "#version = :expected",
          ExpressionAttributeNames: { "#version": "version" },
          ExpressionAttributeValues: { ":expected": expectedVersion },
        }),
      );
      return true;
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === "ConditionalCheckFailedException"
      )
        return false;
      throw error;
    }
  }
  async bind(
    connectionId: string,
    sessionId: string,
    ttl: number,
  ): Promise<void> {
    await this.db.send(
      new PutCommand({
        TableName: this.table,
        Item: { pk: `CONNECTION#${connectionId}`, sessionId, ttl },
      }),
    );
  }
  async lookup(connectionId: string): Promise<string | undefined> {
    const value = await this.db.send(
      new GetCommand({
        TableName: this.table,
        Key: { pk: `CONNECTION#${connectionId}` },
        ConsistentRead: true,
      }),
    );
    return value.Item?.sessionId as string | undefined;
  }
  async unbind(connectionId: string): Promise<void> {
    await this.db.send(
      new DeleteCommand({
        TableName: this.table,
        Key: { pk: `CONNECTION#${connectionId}` },
      }),
    );
  }
}
export class ApiGatewayDelivery implements RelayDelivery {
  constructor(
    private readonly client: Pick<ApiGatewayManagementApiClient, "send">,
  ) {}
  async post(connectionId: string, value: object): Promise<void> {
    await this.client.send(
      new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: Buffer.from(JSON.stringify(value)),
      }),
    );
  }
  async disconnect(connectionId: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteConnectionCommand({ ConnectionId: connectionId }),
      );
    } catch (error) {
      if (!(error instanceof Error) || error.name !== "GoneException")
        throw error;
    }
  }
}
