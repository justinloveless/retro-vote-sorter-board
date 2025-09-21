using FluentAssertions;
using System.Net;
using System.Text.Json;

namespace Retroscope.Api.IntegrationTests;

public class TeamMembersIntegrationTests : IntegrationTestBase
{
    private const string ValidToken = "Bearer valid-user-token";
    private const string InvalidToken = "Bearer invalid-user-token";
    private const string TeamId = "team-123";

    [Fact]
    public async Task GetTeamMembers_WithValidAuth_ReturnsOk()
    {
        // Arrange
        var expectedResponse = new[]
        {
            new
            {
                user_id = "user-1",
                team_id = TeamId,
                role = "admin",
                profiles = new
                {
                    display_name = "John Doe",
                    email = "john@example.com"
                }
            },
            new
            {
                user_id = "user-2",
                team_id = TeamId,
                role = "member",
                profiles = new
                {
                    display_name = "Jane Smith",
                    email = "jane@example.com"
                }
            }
        };

        SetupPostgrestStub($"/team_members?select=user_id,team_id,role,profiles(display_name,email)&team_id=eq.{TeamId}", 
            HttpStatusCode.OK, expectedResponse, ValidToken);

        // Act
        var response = await GetAsync($"/api/teams/{TeamId}/members", ValidToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        
        var content = await response.Content.ReadAsStringAsync();
        var teamMembers = JsonSerializer.Deserialize<JsonElement>(content);
        
        teamMembers.GetProperty("items").GetArrayLength().Should().Be(2);
        
        var firstMember = teamMembers.GetProperty("items")[0];
        firstMember.GetProperty("teamId").GetString().Should().Be(TeamId);
        firstMember.GetProperty("userId").GetString().Should().Be("user-1");
        firstMember.GetProperty("displayName").GetString().Should().Be("John Doe");
        firstMember.GetProperty("email").GetString().Should().Be("john@example.com");
        firstMember.GetProperty("role").GetString().Should().Be("admin");

        // Verify the request was made to PostgREST with correct headers
        VerifyPostgrestRequest($"/team_members?select=user_id,team_id,role,profiles(display_name,email)&team_id=eq.{TeamId}", ValidToken);
    }

    [Fact]
    public async Task GetTeamMembers_WithoutAuth_ReturnsUnauthorized()
    {
        // Act
        var response = await GetAsync($"/api/teams/{TeamId}/members");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetTeamMembers_WithInvalidToken_ReturnsUnauthorized()
    {
        // Act
        var response = await GetAsync($"/api/teams/{TeamId}/members", InvalidToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetTeamMembers_PostgrestReturns500_MapsToBadGateway()
    {
        // Arrange
        SetupPostgrestStub($"/team_members?select=user_id,team_id,role,profiles(display_name,email)&team_id=eq.{TeamId}", 
            HttpStatusCode.InternalServerError, null, ValidToken);

        // Act
        var response = await GetAsync($"/api/teams/{TeamId}/members", ValidToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadGateway);
        
        var content = await response.Content.ReadAsStringAsync();
        var error = JsonSerializer.Deserialize<JsonElement>(content);
        error.GetProperty("error").GetString().Should().Be("Downstream service error");
    }

    [Fact]
    public async Task GetTeamMembers_PostgrestReturns401_MapsToUnauthorized()
    {
        // Arrange
        SetupPostgrestStub($"/team_members?select=user_id,team_id,role,profiles(display_name,email)&team_id=eq.{TeamId}", 
            HttpStatusCode.Unauthorized, null, ValidToken);

        // Act
        var response = await GetAsync($"/api/teams/{TeamId}/members", ValidToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetTeamMembers_PropagatesCorrelationId()
    {
        // Arrange
        var expectedResponse = new[]
        {
            new
            {
                user_id = "user-1",
                team_id = TeamId,
                role = "admin",
                profiles = new
                {
                    display_name = "John Doe",
                    email = "john@example.com"
                }
            }
        };

        SetupPostgrestStub($"/team_members?select=user_id,team_id,role,profiles(display_name,email)&team_id=eq.{TeamId}", 
            HttpStatusCode.OK, expectedResponse, ValidToken);

        // Act
        var request = new HttpRequestMessage(HttpMethod.Get, $"/api/teams/{TeamId}/members");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", ValidToken);
        request.Headers.Add("X-Correlation-Id", "test-correlation-id");
        
        var response = await Client.SendAsync(request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Headers.Should().ContainKey("X-Correlation-Id");
        response.Headers.GetValues("X-Correlation-Id").First().Should().Be("test-correlation-id");
    }
}
