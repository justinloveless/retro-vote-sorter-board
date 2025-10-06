using System.Text.Json.Serialization;
namespace Retroscope.Application.DTOs.Teams;

public class TeamNameItem
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
}