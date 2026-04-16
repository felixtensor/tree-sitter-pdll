package tree_sitter_pdll_test

import (
	"testing"

	tree_sitter "github.com/tree-sitter/go-tree-sitter"
	tree_sitter_pdll "github.com/felixtensor/tree-sitter-pdll/bindings/go"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_pdll.Language())
	if language == nil {
		t.Errorf("Error loading PDLL grammar")
	}
}
