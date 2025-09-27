using System.Net;
using System.Text;
using System.Text.Json;
using FluentAssertions;

namespace Retroscope.Api.IntegrationTests;

public class TeamMembersWriteIntegrationTests : IntegrationTestBase
{
    [Fact]
    public async Task AddMember_Returns204()
    {
        SetupPostgrestStub(
            "/team_members",
            HttpStatusCode.Created,
            responseBody: new[] { new { team_id = "team-1", user_id = "user-x" } },
            method: "POST"
        );

        Client.DefaultRequestHeaders.Add("Authorization", "Bearer valid-user-token");
        var content = new StringContent(JsonSerializer.Serialize(new { user_id = "user-x", role = "member" }), Encoding.UTF8, "application/json");
        var resp = await Client.PostAsync("/api/teams/team-1/members", content);
        resp.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task UpdateMemberRole_Returns204()
    {
        SetupPostgrestStub(
            "/team_members?team_id=eq.team-1&user_id=eq.user-x",
            HttpStatusCode.OK,
            responseBody: new[] { new { role = "admin" } },
            method: "PATCH"
        );

        Client.DefaultRequestHeaders.Add("Authorization", "Bearer valid-user-token");
        var content = new StringContent(JsonSerializer.Serialize(new { role = "admin" }), Encoding.UTF8, "application/json");
        var resp = await Client.PatchAsync("/api/teams/team-1/members/user-x", content);
        resp.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task RemoveMember_Returns204()
    {
        SetupPostgrestStub(
            "/team_members?team_id=eq.team-1&user_id=eq.user-x",
            HttpStatusCode.NoContent,
            responseBody: null,
            method: "DELETE"
        );

        Client.DefaultRequestHeaders.Add("Authorization", "Bearer valid-user-token");
        var resp = await Client.DeleteAsync("/api/teams/team-1/members/user-x");
        resp.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }
}


