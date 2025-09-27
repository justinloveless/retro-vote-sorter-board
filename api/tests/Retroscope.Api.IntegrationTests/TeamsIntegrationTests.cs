using System.Net;
using System.Text;
using System.Text.Json;
using FluentAssertions;

namespace Retroscope.Api.IntegrationTests;

public class TeamsIntegrationTests : IntegrationTestBase
{
    [Fact]
    public async Task GetTeams_Returns200_WithItems()
    {
        SetupPostgrestStub(
            "/teams?select=*&order=created_at.desc",
            HttpStatusCode.OK,
            responseBody: new[] { new { id = "t1", name = "Alpha" } }
        );

        Client.DefaultRequestHeaders.Add("Authorization", "Bearer valid-user-token");

        var resp = await Client.GetAsync("/api/teams");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadAsStringAsync();
        body.Should().Contain("Alpha");
    }

    [Fact]
    public async Task CreateTeam_Returns201()
    {
        SetupPostgrestStub(
            "/teams",
            HttpStatusCode.Created,
            responseBody: new[] { new { id = "t2", name = "Beta" } },
            method: "POST"
        );

        Client.DefaultRequestHeaders.Add("Authorization", "Bearer valid-user-token");
        var content = new StringContent(JsonSerializer.Serialize(new { name = "Beta" }), Encoding.UTF8, "application/json");
        var resp = await Client.PostAsync("/api/teams", content);
        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await resp.Content.ReadAsStringAsync();
        body.Should().Contain("t2");
    }

    [Fact]
    public async Task UpdateTeam_Returns200()
    {
        SetupPostgrestStub(
            "/teams?id=eq.t3",
            HttpStatusCode.OK,
            responseBody: new[] { new { id = "t3", name = "Gamma" } },
            method: "PATCH"
        );

        Client.DefaultRequestHeaders.Add("Authorization", "Bearer valid-user-token");
        var content = new StringContent(JsonSerializer.Serialize(new { name = "Gamma" }), Encoding.UTF8, "application/json");
        var resp = await Client.PatchAsync("/api/teams/t3", content);
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadAsStringAsync();
        body.Should().Contain("Gamma");
    }

    [Fact]
    public async Task DeleteTeam_Returns204()
    {
        SetupPostgrestStub(
            "/teams?id=eq.t4",
            HttpStatusCode.NoContent,
            responseBody: null,
            method: "DELETE"
        );

        Client.DefaultRequestHeaders.Add("Authorization", "Bearer valid-user-token");
        var resp = await Client.DeleteAsync("/api/teams/t4");
        resp.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task GetTeamById_Returns200()
    {
        SetupPostgrestStub(
            "/teams?id=eq.t5",
            HttpStatusCode.OK,
            responseBody: new[] { new { id = "t5", name = "Delta" } }
        );
        SetupPostgrestStub(
            "/team_members?select=user_id,team_id,role&team_id=eq.t5",
            HttpStatusCode.OK,
            responseBody: new[] { new { team_id = "t5", user_id = "user-x", role = "member" } }
        );

        Client.DefaultRequestHeaders.Add("Authorization", "Bearer valid-user-token");
        var resp = await Client.GetAsync("/api/teams/t5");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadAsStringAsync();
        body.Should().Contain("Delta");
        body.Should().Contain("user-x");
    }
}


