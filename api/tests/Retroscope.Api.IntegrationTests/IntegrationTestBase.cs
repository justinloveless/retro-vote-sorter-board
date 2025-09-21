using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using WireMock.Net;
using WireMock.Server;

namespace Retroscope.Api.IntegrationTests;

public abstract class IntegrationTestBase : IDisposable
{
    protected readonly WebApplicationFactory<Program> Factory;
    protected readonly HttpClient Client;
    protected readonly WireMockServer WireMockServer;
    protected readonly string PostgrestUrl;
    protected readonly string FunctionsUrl;

    protected IntegrationTestBase()
    {
        // Start WireMock server
        WireMockServer = WireMockServer.Start();
        
        // Configure URLs for the stubbed services
        var baseUrl = WireMockServer.Urls[0].TrimEnd('/') + "/";
        PostgrestUrl = baseUrl + "postgrest/";
        FunctionsUrl = baseUrl + "functions/";

        // Create factory with custom configuration
        Factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Testing");
                builder.ConfigureAppConfiguration((context, config) =>
                {
                    var overrides = new Dictionary<string, string?>
                    {
                        ["SUPABASE_POSTGREST_URL"] = PostgrestUrl,
                        ["SUPABASE_FUNCTIONS_URL"] = FunctionsUrl,
                        // Keep JWKS as-is for app auth; not used in these tests
                    };
                    config.AddInMemoryCollection(overrides);
                });
                
                // Override configuration to point to WireMock
                builder.ConfigureServices(services =>
                {
                    // Remove existing Supabase gateway registration
                    var descriptor = services.SingleOrDefault(
                        d => d.ServiceType == typeof(Retroscope.Application.Interfaces.ISupabaseGateway));
                    if (descriptor != null)
                    {
                        services.Remove(descriptor);
                    }
                    
                    // Register real SupabaseGateway with WireMock URLs
                    services.AddHttpClient("PostgrestClient", client =>
                    {
                        client.BaseAddress = new Uri(PostgrestUrl);
                        client.DefaultRequestHeaders.Add("User-Agent", "Retroscope-API/1.0");
                    });
                    
                    services.AddHttpClient("FunctionsClient", client =>
                    {
                        client.BaseAddress = new Uri(FunctionsUrl);
                        client.DefaultRequestHeaders.Add("User-Agent", "Retroscope-API/1.0");
                    });
                    
                    services.AddScoped<Retroscope.Application.Interfaces.ISupabaseGateway, 
                        Retroscope.Infrastructure.SupabaseGateway>();
                    
                    // Add test authentication scheme for integration tests
                    services.AddAuthentication(options =>
                    {
                        options.DefaultAuthenticateScheme = "Test";
                        options.DefaultChallengeScheme = "Test";
                    })
                    .AddScheme<Microsoft.AspNetCore.Authentication.AuthenticationSchemeOptions, TestAuthHandler>(
                        "Test", _ => { });
                });
            });

        Client = Factory.CreateClient();
    }

    protected async Task<HttpResponseMessage> GetAsync(string endpoint, string? authToken = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, endpoint);
        if (!string.IsNullOrEmpty(authToken))
        {
            if (authToken.StartsWith("Bearer "))
            {
                request.Headers.TryAddWithoutValidation("Authorization", authToken);
            }
            else
            {
                request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", authToken);
            }
        }
        return await Client.SendAsync(request);
    }

    protected async Task<HttpResponseMessage> PostAsync(string endpoint, object? content = null, string? authToken = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
        if (!string.IsNullOrEmpty(authToken))
        {
            if (authToken.StartsWith("Bearer "))
            {
                request.Headers.TryAddWithoutValidation("Authorization", authToken);
            }
            else
            {
                request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", authToken);
            }
        }
        
        if (content != null)
        {
            var json = JsonSerializer.Serialize(content);
            request.Content = new StringContent(json, Encoding.UTF8, "application/json");
        }
        
        return await Client.SendAsync(request);
    }

    protected void SetupPostgrestStub(string path, HttpStatusCode statusCode, object? responseBody = null, string? authHeader = null)
    {
        var purePath = path.Split('?')[0];
        var requestBuilder = WireMockServer
            .Given(WireMock.RequestBuilders.Request.Create()
                .WithPath($"/postgrest/{purePath.TrimStart('/')}")
                .UsingGet());

        // Note: WireMock header matching can be added later if needed
        // For now, we'll focus on basic request/response matching

        var response = WireMock.ResponseBuilders.Response.Create()
            .WithStatusCode(statusCode);

        if (responseBody != null)
        {
            var json = JsonSerializer.Serialize(responseBody);
            response = response.WithBody(json, "application/json");
        }

        requestBuilder.RespondWith(response);
    }

    protected void SetupFunctionsStub(string path, HttpStatusCode statusCode, object? responseBody = null, string? authHeader = null)
    {
        var pureFnPath = path.Split('?')[0];
        var requestBuilder = WireMockServer
            .Given(WireMock.RequestBuilders.Request.Create()
                .WithPath($"/functions/{pureFnPath.TrimStart('/')}")
                .UsingPost());

        // Note: WireMock header matching can be added later if needed
        // For now, we'll focus on basic request/response matching

        var response = WireMock.ResponseBuilders.Response.Create()
            .WithStatusCode(statusCode);

        if (responseBody != null)
        {
            var json = JsonSerializer.Serialize(responseBody);
            response = response.WithBody(json, "application/json");
        }

        requestBuilder.RespondWith(response);
    }

    protected void VerifyPostgrestRequest(string path, string? authHeader = null)
    {
        var verifyPurePath = path.Split('?')[0];
        var requests = WireMockServer.LogEntries
            .Where(log => log.RequestMessage.Path == $"/postgrest/{verifyPurePath.TrimStart('/')}")
            .ToList();

        requests.Should().HaveCount(1, "Expected exactly one request to PostgREST");
        
        if (!string.IsNullOrEmpty(authHeader))
        {
            var request = requests.First().RequestMessage;
            request.Headers.Should().ContainKey("Authorization");
            request.Headers["Authorization"].FirstOrDefault().Should().Be(authHeader);
        }
    }

    protected void VerifyFunctionsRequest(string path, string? authHeader = null)
    {
        var verifyFnPath = path.Split('?')[0];
        var requests = WireMockServer.LogEntries
            .Where(log => log.RequestMessage.Path == $"/functions/{verifyFnPath.TrimStart('/')}")
            .ToList();

        requests.Should().HaveCount(1, "Expected exactly one request to Functions");
        
        if (!string.IsNullOrEmpty(authHeader))
        {
            var request = requests.First().RequestMessage;
            request.Headers.Should().ContainKey("Authorization");
            request.Headers["Authorization"].FirstOrDefault().Should().Be(authHeader);
        }
    }

    public void Dispose()
    {
        Client?.Dispose();
        Factory?.Dispose();
        WireMockServer?.Stop();
        WireMockServer?.Dispose();
    }
}
