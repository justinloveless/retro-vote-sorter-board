using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Retroscope.Api.Controllers;
using Retroscope.Application.DTOs.TeamMembers;
using Retroscope.Application.DTOs.Teams;
using Retroscope.Application.Interfaces;

namespace Retroscope.Api.UnitTests.Controllers;

public class TeamsControllerTests
{
    [Fact]
    public async Task GetTeams_ReturnsOk_WithItems()
    {
        var mockGateway = new Mock<ISupabaseGateway>();
        mockGateway.Setup(g => g.GetTeamsAsync(It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TeamsResponse { Items = [new TeamItem { Id = "t1", Name = "Alpha" }] });

        var controller = new TeamsController(mockGateway.Object)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
        controller.HttpContext.Request.Headers["Authorization"] = "Bearer test";

        var result = await controller.GetTeams();
        var ok = result.Result as OkObjectResult;
        ok.Should().NotBeNull();
        var body = ok!.Value as TeamsResponse;
        body!.Items.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetTeamById_ReturnsOk_WhenTeamExists()
    {
        var mockGateway = new Mock<ISupabaseGateway>();
        mockGateway.Setup(g => g.GetTeamByIdAsync(It.IsAny<string>(), "t1", It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new TeamDetailsResponse
            {
                Team = new TeamItem { Id = "t1", Name = "Alpha" },
                Members = []
            });

        var controller = new TeamsController(mockGateway.Object)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
        controller.HttpContext.Request.Headers["Authorization"] = "Bearer test";

        var result = await controller.GetTeamById("t1");
        var ok = result.Result as OkObjectResult;
        ok.Should().NotBeNull();
        var details = ok!.Value as TeamDetailsResponse;
        details!.Team!.Id.Should().Be("t1");
    }

    [Fact]
    public async Task CreateTeam_ReturnsCreated_WithItem()
    {
        var mockGateway = new Mock<ISupabaseGateway>();
        var created = new TeamItem { Id = "t2", Name = "Beta" };
        mockGateway.Setup(g => g.CreateTeamAsync(It.IsAny<string>(), It.IsAny<CreateTeamRequest>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(created);

        var controller = new TeamsController(mockGateway.Object)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
        controller.HttpContext.Request.Headers["Authorization"] = "Bearer test";

        var result = await controller.CreateTeam(new CreateTeamRequest { Name = "Beta" });
        var createdResult = result.Result as CreatedResult;
        createdResult.Should().NotBeNull();
        (createdResult!.Value as TeamItem)!.Id.Should().Be("t2");
    }

    [Fact]
    public async Task UpdateTeam_ReturnsOk_WithUpdatedItem()
    {
        var mockGateway = new Mock<ISupabaseGateway>();
        var updated = new TeamItem { Id = "t3", Name = "Gamma" };
        mockGateway.Setup(g => g.UpdateTeamAsync(It.IsAny<string>(), "t3", It.IsAny<UpdateTeamRequest>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(updated);

        var controller = new TeamsController(mockGateway.Object)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
        controller.HttpContext.Request.Headers["Authorization"] = "Bearer test";

        var result = await controller.UpdateTeam("t3", new UpdateTeamRequest { Name = "Gamma" });
        var ok = result.Result as OkObjectResult;
        (ok!.Value as TeamItem)!.Name.Should().Be("Gamma");
    }

    [Fact]
    public async Task DeleteTeam_ReturnsNoContent_OnSuccess()
    {
        var mockGateway = new Mock<ISupabaseGateway>();
        mockGateway.Setup(g => g.DeleteTeamAsync(It.IsAny<string>(), "t4", It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var controller = new TeamsController(mockGateway.Object)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
        controller.HttpContext.Request.Headers["Authorization"] = "Bearer test";

        var result = await controller.DeleteTeam("t4");
        result.Should().BeOfType<NoContentResult>();
    }
}


