using FluentAssertions;
using System.Net;

namespace Retroscope.Api.UnitTests.Controllers;

public class HealthControllerTests
{
    [Fact]
    public async Task GetHealth_ReturnsOk()
    {
        // Arrange
        var factory = new TestApiFactory();
        var client = factory.CreateClient();

        // Act
        var response = await client.GetAsync("/healthz");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("healthy");
        content.Should().Contain("timestamp");
    }

    [Fact]
    public async Task GetReadiness_WithValidJwksUrl_ReturnsServiceUnavailable()
    {
        // Arrange - The real JWKS endpoint returns 401, so this should return 503
        var factory = new TestApiFactory();
        var client = factory.CreateClient();

        // Act
        var response = await client.GetAsync("/readyz");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("JWKS endpoint not accessible");
    }

    [Fact]
    public async Task GetReadiness_WithoutJwksUrl_ReturnsServiceUnavailable()
    {
        // Arrange
        var factory = new TestApiFactory()
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureServices(services =>
                {
                    // Remove the JWKS URL configuration
                });
            });

        // Override configuration to remove JWKS URL
        factory = factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("SUPABASE_JWKS_URL", "");
        });

        var client = factory.CreateClient();

        // Act
        var response = await client.GetAsync("/readyz");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("JWKS URL not configured");
    }

    [Fact]
    public async Task GetReadiness_WithInvalidJwksUrl_ReturnsServiceUnavailable()
    {
        // Arrange
        var factory = new TestApiFactory()
            .WithWebHostBuilder(builder =>
            {
                builder.UseSetting("SUPABASE_JWKS_URL", "https://invalid-url-that-does-not-exist.com/auth/v1/keys");
            });

        var client = factory.CreateClient();

        // Act
        var response = await client.GetAsync("/readyz");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("JWKS endpoint not accessible");
    }
}
