using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Retroscope.Infrastructure.Postgres.Entities;

[Table("retro_boards", Schema = "public")]
public class RetroBoard
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Required]
    [Column("title")]
    public string Title { get; set; } = string.Empty;

    [Required]
    [Column("team_id")]
    public Guid TeamId { get; set; }

    [Required]
    [Column("created_by")]
    public Guid CreatedBy { get; set; }

    [Required]
    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }

    [Column("status")]
    public string? Status { get; set; }

    [Column("current_stage")]
    public string? CurrentStage { get; set; }

    [Column("enforce_stage_readiness")]
    public bool? EnforceStageReadiness { get; set; }

    // Navigation properties
    [ForeignKey("TeamId")]
    public Team? Team { get; set; }
}

