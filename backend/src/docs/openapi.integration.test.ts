import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";

describe("API documentation", () => {
  const app = createApp();

  it("serves the OpenAPI document", async () => {
    const response = await request(app).get("/openapi.json");

    expect(response.status).toBe(200);
    expect(response.body.openapi).toBe("3.1.0");
    expect(response.body.info.title).toBe("Study Board API");
    expect(response.body.paths["/api/auth/register"].post).toBeDefined();
    expect(response.body.paths["/api/posts"].get).toBeDefined();
  });

  it("serves the Swagger UI", async () => {
    const response = await request(app).get("/api-docs/");

    expect(response.status).toBe(200);
    expect(response.text).toContain("Study Board API Docs");
    expect(response.text).toContain("swagger-ui-bundle.js");
  });
});
