using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Retroscope.Infrastructure.Postgres.Entities;

[Table("retro_columns", Schema = "public")]
public class RetroColumn
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Required]
    [Column("board_id")]
    public Guid BoardId { get; set; }

    [Required]
    [Column("title")]
    public string Title { get; set; } = string.Empty;

    [Required]
    [Column("position")]
    public int Position { get; set; }

    [Column("color")]
    public string? Color { get; set; }

    [Required]
    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    [ForeignKey("BoardId")]
    public RetroBoard? RetroBoard { get; set; }
}

