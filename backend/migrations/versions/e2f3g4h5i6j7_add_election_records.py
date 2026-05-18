"""add alder_election_records table

Revision ID: e2f3g4h5i6j7
Revises: d1e2f3g4h5i6
Create Date: 2026-05-18

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'e2f3g4h5i6j7'
down_revision: Union[str, Sequence[str], None] = 'd1e2f3g4h5i6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'alder_election_records',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('alder_id', sa.Integer(), sa.ForeignKey('alders.id'), nullable=False),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('election_type', sa.String(20), nullable=False),
        sa.Column('result', sa.String(20), nullable=False),
        sa.Column('vote_pct', sa.Numeric(5, 2), nullable=True),
        sa.Column('opponent_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('was_uncontested', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('notes', sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('alder_election_records')
